import { LitElement, html, nothing } from 'lit';
import type { CSSResultGroup, PropertyValues } from 'lit';
import { property, state } from 'lit/decorators.js';
import { repeat } from 'lit/directives/repeat.js';
import {
  hasConfigOrEntityChanged,
  fireEvent,
  HomeAssistant,
  ServiceCallRequest,
  computeStateDisplay,
  stateIcon,
} from 'custom-card-helpers';
import registerTemplates from 'ha-template';
import get from 'lodash/get';
import localize from './localize';
import styles from './styles.css';
import buildConfig from './config';
import {
  Template,
  VacuumCardAction,
  VacuumCardOption,
  VacuumCardConfig,
  VacuumEntity,
  HassEntity,
  VacuumBatteryEntity,
  VacuumEntityState,
  VacuumServiceCallParams,
  VacuumActionParams,
  VacuumArea,
  VacuumAreaSection,
  VacuumFloor,
} from './types';
import DEFAULT_IMAGE from './vacuum.svg';

registerTemplates();

// String in the right side will be replaced by Rollup
const PKG_VERSION = 'PKG_VERSION_VALUE';

// VacuumEntityFeature.CLEAN_AREA in Home Assistant
const FEATURE_CLEAN_AREA = 16384;

console.info(
  `%c VACUUM-CARD %c ${PKG_VERSION}`,
  'color: white; background: blue; font-weight: 700;',
  'color: blue; background: white; font-weight: 700;',
);

if (!customElements.get('ha-icon-button')) {
  customElements.define(
    'ha-icon-button',
    class extends (customElements.get('paper-icon-button') ?? HTMLElement) {},
  );
}

export class VacuumCard extends LitElement {
  @property({ attribute: false }) public hass!: HomeAssistant;

  @state() private config!: VacuumCardConfig;
  @state() private requestInProgress = false;
  @state() private thumbUpdater: ReturnType<typeof setInterval> | null = null;
  @state() private mappedAreaIds: string[] = [];
  @state() private selectedAreaIds: string[] = [];
  @state() private areasExpanded = false;
  private areasLoadedFor: string | null = null;

  static get styles(): CSSResultGroup {
    return styles;
  }

  public static async getConfigElement() {
    await import('./editor');
    return document.createElement('vacuum-card-editor');
  }

  static getStubConfig(_: unknown, entities: string[]) {
    const [vacuumEntity] = entities.filter((eid) => eid.startsWith('vacuum'));

    return {
      entity: vacuumEntity ?? '',
    };
  }

  get entity(): VacuumEntity {
    return this.hass.states[this.config.entity] as VacuumEntity;
  }

  get map(): HassEntity | null {
    if (!this.hass || !this.config.map) {
      return null;
    }
    return this.hass.states[this.config.map];
  }

  get batteryEntity(): VacuumBatteryEntity | null {
    const batteryEntityId = this.config.battery_entity;
    if (!this.hass || !batteryEntityId) {
      return null;
    }
    return (this.hass.states[batteryEntityId] as VacuumBatteryEntity) ?? null;
  }

  public setConfig(config: VacuumCardConfig): void {
    this.config = buildConfig(config);
    this.areasExpanded = this.config.expand_areas;
    this.areasLoadedFor = null;
  }

  public getCardSize(): number {
    return this.config.compact_view ? 3 : 8;
  }

  public shouldUpdate(changedProps: PropertyValues): boolean {
    if (hasConfigOrEntityChanged(this, changedProps, false)) {
      return true;
    }

    // Options are separate entities, so the vacuum entity check misses them
    const oldHass = changedProps.get('hass') as HomeAssistant | undefined;
    return (
      !!oldHass &&
      this.config.options
        .flatMap(({ entity, visible_when }) => [entity, visible_when?.entity])
        .some(
          (entityId) =>
            !!entityId &&
            oldHass.states[entityId] !== this.hass.states[entityId],
        )
    );
  }

  protected updated(changedProps: PropertyValues) {
    if (
      changedProps.get('hass') &&
      changedProps.get('hass').states[this.config.entity].state !==
        this.hass.states[this.config.entity].state
    ) {
      this.requestInProgress = false;
    }

    if (this.hass && this.areasLoadedFor !== this.config.entity) {
      this.loadAreas();
    }
  }

  get supportsCleanArea(): boolean {
    const features = this.entity?.attributes.supported_features ?? 0;
    return (features & FEATURE_CLEAN_AREA) !== 0;
  }

  // Areas the vacuum's segments are mapped to in Home Assistant, grouped by floor
  get areaSections(): VacuumAreaSection[] {
    const hass = this.hass as HomeAssistant & {
      areas?: Record<string, VacuumArea>;
      floors?: Record<string, VacuumFloor>;
    };
    const mapped = new Set(this.mappedAreaIds);
    const areas = Object.values(hass.areas ?? {}).filter((area) =>
      mapped.has(area.area_id),
    );
    const floors = Object.values(hass.floors ?? {});
    const floorIds = new Set(floors.map((floor) => floor.floor_id));

    const sections: VacuumAreaSection[] = floors.map((floor) => ({
      floor,
      areas: areas.filter((area) => area.floor_id === floor.floor_id),
    }));
    sections.push({
      floor: null,
      areas: areas.filter(
        (area) => !area.floor_id || !floorIds.has(area.floor_id),
      ),
    });

    return sections.filter((section) => section.areas.length > 0);
  }

  private async loadAreas(): Promise<void> {
    const entityId = this.config.entity;
    this.areasLoadedFor = entityId;

    if (!this.config.show_areas || !this.supportsCleanArea) {
      this.mappedAreaIds = [];
      return;
    }

    try {
      const entry = await this.hass.callWS<{
        options?: { vacuum?: { area_mapping?: Record<string, unknown> } };
      }>({
        type: 'config/entity_registry/get',
        entity_id: entityId,
      });

      if (this.config.entity !== entityId) {
        return;
      }

      this.mappedAreaIds = Object.keys(
        entry?.options?.vacuum?.area_mapping ?? {},
      );
      this.selectedAreaIds = this.selectedAreaIds.filter((id) =>
        this.mappedAreaIds.includes(id),
      );
    } catch (err) {
      console.warn('vacuum-card: failed to load vacuum areas', err);
      this.mappedAreaIds = [];
    }
  }

  get visibleOptions(): VacuumCardOption[] {
    const matches = (expected: string | string[], state?: string) =>
      state !== undefined && [expected].flat().map(String).includes(state);

    return this.config.options.filter(({ entity, visible_when }) => {
      const stateObj = this.hass.states[entity];
      if (!stateObj || stateObj.state === 'unavailable') {
        return false;
      }
      if (!visible_when) {
        return true;
      }

      const state = this.hass.states[visible_when.entity]?.state;
      return (
        (visible_when.state === undefined ||
          matches(visible_when.state, state)) &&
        (visible_when.state_not === undefined ||
          !matches(visible_when.state_not, state))
      );
    });
  }

  private handleOption(
    entityId: string,
    e: CustomEvent<{ item?: { value?: string } }>,
  ): void {
    const option = e.detail.item?.value;
    if (option === undefined) {
      return;
    }

    const [domain] = entityId.split('.');
    this.hass.callService(domain, 'select_option', {
      entity_id: entityId,
      option,
    });
  }

  private toggleAreas(): void {
    this.areasExpanded = !this.areasExpanded;
    if (this.areasExpanded) {
      this.loadAreas();
    }
  }

  private toggleArea(areaId: string): void {
    this.selectedAreaIds = this.selectedAreaIds.includes(areaId)
      ? this.selectedAreaIds.filter((id) => id !== areaId)
      : [...this.selectedAreaIds, areaId];
  }

  private async handleStart(): Promise<void> {
    if (this.selectedAreaIds.length === 0) {
      return this.handleVacuumAction('start')();
    }

    this.requestInProgress = true;
    try {
      await this.hass.callService('vacuum', 'clean_area', {
        entity_id: this.config.entity,
        cleaning_area_id: this.selectedAreaIds,
      });
      this.selectedAreaIds = [];
    } catch {
      // Home Assistant reports the failed action; keep the selection for a retry
      this.requestInProgress = false;
    }
  }

  public connectedCallback() {
    super.connectedCallback();
    if (!this.config.compact_view && this.map) {
      this.requestUpdate();
      this.thumbUpdater = setInterval(
        () => this.requestUpdate(),
        this.config.map_refresh * 1000,
      );
    }
  }

  public disconnectedCallback() {
    super.disconnectedCallback();
    if (this.map && this.thumbUpdater) {
      clearInterval(this.thumbUpdater);
    }
  }

  private handleMore(entityId: string = this.entity.entity_id): void {
    fireEvent(
      this,
      'hass-more-info',
      {
        entityId,
      },
      {
        bubbles: false,
        composed: true,
      },
    );
  }

  private callService(action: VacuumCardAction) {
    const { service, service_data, target } = action;
    const [domain, name] = service.split('.');
    this.hass.callService(domain, name, service_data, target);
  }

  private callVacuumService(
    service: ServiceCallRequest['service'],
    params: VacuumServiceCallParams = { request: true },
    options: ServiceCallRequest['serviceData'] = {},
  ) {
    this.hass.callService('vacuum', service, {
      entity_id: this.config.entity,
      ...options,
    });

    if (params.request) {
      this.requestInProgress = true;
      this.requestUpdate();
    }
  }

  private handleSpeed(e: CustomEvent<{ item?: { value?: string } }>): void {
    this.callVacuumService(
      'set_fan_speed',
      {
        request: false,
      },
      {
        fan_speed: e.detail.item?.value,
      },
    );
  }

  private renderDropdown({
    icon,
    value,
    options,
    onSelect,
    formatLabel,
    ariaLabel,
  }: {
    icon: string;
    value: string;
    options: string[];
    onSelect: (e: CustomEvent<{ item?: { value?: string } }>) => void;
    formatLabel: (value: string) => string;
    ariaLabel?: string;
  }): Template {
    const selectedLabel = formatLabel(value);

    return html`
      <div class="tip dropdown-tip" @click=${(e: Event) => e.stopPropagation()}>
        <ha-dropdown placement="bottom" @wa-select=${onSelect}>
          <button
            class="dropdown-trigger"
            slot="trigger"
            aria-label=${ariaLabel ?? selectedLabel}
          >
            <ha-icon icon=${icon}></ha-icon>
            <span class="tip-title">${selectedLabel}</span>
            <ha-icon
              class="dropdown-trigger-arrow"
              icon="mdi:menu-down"
            ></ha-icon>
          </button>
          ${repeat(
            options,
            (item) => item,
            (item) => html`
              <ha-dropdown-item .value=${item} ?checked=${item === value}>
                ${formatLabel(item)}
              </ha-dropdown-item>
            `,
          )}
        </ha-dropdown>
      </div>
    `;
  }

  private handleVacuumAction(
    action: string,
    params: VacuumActionParams = { request: true },
  ) {
    return () => {
      if (!this.config.actions[action]) {
        return this.callVacuumService(params.defaultService || action, params);
      }

      this.callService(this.config.actions[action]);
    };
  }

  private getAttributes(entity: VacuumEntity) {
    const { status, state } = entity.attributes;

    return {
      ...entity.attributes,
      status: status ?? state ?? entity.state,
    };
  }

  // Falls back to translations shipped by the vacuum integration itself
  private formatStatus(entity: VacuumEntity): string | undefined {
    const hass = this.hass as HomeAssistant & {
      formatEntityState?: (stateObj: HassEntity) => string;
      formatEntityAttributeValue?: (
        stateObj: HassEntity,
        attribute: string,
      ) => string;
    };
    const { status, state } = entity.attributes;

    if (status != null) {
      return hass.formatEntityAttributeValue?.(entity, 'status');
    }

    if (state != null) {
      return hass.formatEntityAttributeValue?.(entity, 'state');
    }

    return hass.formatEntityState?.(entity);
  }

  private renderSource(): Template {
    const { fan_speed: source, fan_speed_list: sources } = this.getAttributes(
      this.entity,
    );

    if (!Array.isArray(sources) || sources.length === 0 || !source) {
      return nothing;
    }

    return this.renderDropdown({
      icon: 'mdi:fan',
      value: source,
      options: sources,
      onSelect: this.handleSpeed,
      formatLabel: (value: string) =>
        localize(`source.${value.toLowerCase()}`) ?? value,
      ariaLabel: localize('source.fan_speed') || 'Fan speed',
    });
  }

  private getBatteryDisplay(): {
    icon: string;
    value: string;
    entityId: string;
  } | null {
    const batteryEntity = this.batteryEntity;

    if (batteryEntity) {
      const value = computeStateDisplay(
        this.hass.localize,
        batteryEntity,
        this.hass.locale,
      );
      const icon = stateIcon(batteryEntity) ?? 'mdi:battery';

      return {
        icon,
        value,
        entityId: batteryEntity.entity_id,
      };
    }

    const { battery_level, battery_icon } = this.getAttributes(this.entity);

    if (battery_level == null) {
      return null;
    }

    return {
      icon: battery_icon ?? 'mdi:battery',
      value: `${battery_level}%`,
      entityId: this.entity.entity_id,
    };
  }

  private renderBattery(): Template {
    const battery = this.getBatteryDisplay();

    if (!battery) {
      return nothing;
    }

    return html`
      <div class="tip" @click="${() => this.handleMore(battery.entityId)}">
        <ha-icon icon="${battery.icon}"></ha-icon>
        <span class="tip-title">${battery.value}</span>
      </div>
    `;
  }

  private renderMapOrImage(state: VacuumEntityState): Template {
    if (this.config.compact_view) {
      return nothing;
    }

    if (this.map) {
      return this.map && this.map.attributes.entity_picture
        ? html`
            <img
              class="map"
              src="${this.map.attributes.entity_picture}&v=${Date.now()}"
              @click=${() => this.handleMore(this.config.map)}
            />
          `
        : nothing;
    }

    const src =
      this.config.image === 'default' ? DEFAULT_IMAGE : this.config.image;

    return html`
      <img
        class="vacuum ${state}"
        src="${src}"
        @click="${() => this.handleMore()}"
      />
    `;
  }

  private renderStats(state: VacuumEntityState): Template {
    const statsList =
      this.config.stats[state] || this.config.stats.default || [];

    const stats = statsList.map(
      ({ entity_id, attribute, value_template, unit, subtitle }) => {
        if (!entity_id && !attribute) {
          return nothing;
        }

        let state = '';

        if (entity_id && attribute) {
          state = get(this.hass.states[entity_id].attributes, attribute);
        } else if (attribute) {
          state = get(this.entity.attributes, attribute);
        } else if (entity_id) {
          state = this.hass.states[entity_id].state;
        } else {
          return nothing;
        }

        const value = html`
          <ha-template
            hass=${this.hass}
            template=${value_template}
            value=${state}
            variables=${{ value: state }}
          ></ha-template>
        `;

        return html`
          <div class="stats-block" @click="${() => this.handleMore(entity_id)}">
            <span class="stats-value">${value}</span>
            ${unit}
            <div class="stats-subtitle">${subtitle}</div>
          </div>
        `;
      },
    );

    if (!stats.length) {
      return nothing;
    }

    return html`<div class="stats">${stats}</div>`;
  }

  private renderName(): Template {
    const { friendly_name } = this.getAttributes(this.entity);

    if (!this.config.show_name) {
      return nothing;
    }

    return html` <div class="vacuum-name">${friendly_name}</div> `;
  }

  private renderStatus(): Template {
    const { status } = this.getAttributes(this.entity);
    const localizedStatus =
      localize(`status.${status.toLowerCase()}`) ||
      this.formatStatus(this.entity) ||
      status;

    if (!this.config.show_status) {
      return nothing;
    }

    return html`
      <div class="status">
        ${
          this.requestInProgress
            ? html`<ha-spinner class="status-spinner" size="tiny"></ha-spinner>`
            : nothing
        }
        <span class="status-text" alt=${localizedStatus}>
          ${localizedStatus}
        </span>
      </div>
    `;
  }

  private renderToolbar(state: VacuumEntityState): Template {
    if (!this.config.show_toolbar) {
      return nothing;
    }

    switch (state) {
      case 'on':
      case 'auto':
      case 'spot':
      case 'edge':
      case 'single_room':
      case 'cleaning': {
        return html`
          <div class="toolbar">
            <paper-button @click="${this.handleVacuumAction('pause')}">
              <ha-icon icon="hass:pause"></ha-icon>
              ${localize('common.pause')}
            </paper-button>
            <paper-button @click="${this.handleVacuumAction('stop')}">
              <ha-icon icon="hass:stop"></ha-icon>
              ${localize('common.stop')}
            </paper-button>
            <paper-button @click="${this.handleVacuumAction('return_to_base')}">
              <ha-icon icon="hass:home-map-marker"></ha-icon>
              ${localize('common.return_to_base')}
            </paper-button>
          </div>
        `;
      }

      case 'paused': {
        return html`
          <div class="toolbar">
            <paper-button
              @click="${this.handleVacuumAction('resume', {
                defaultService: 'start',
                request: true,
              })}"
            >
              <ha-icon icon="hass:play"></ha-icon>
              ${localize('common.continue')}
            </paper-button>
            <paper-button @click="${this.handleVacuumAction('return_to_base')}">
              <ha-icon icon="hass:home-map-marker"></ha-icon>
              ${localize('common.return_to_base')}
            </paper-button>
          </div>
        `;
      }

      case 'returning': {
        return html`
          <div class="toolbar">
            <paper-button
              @click="${this.handleVacuumAction('resume', {
                defaultService: 'start',
                request: true,
              })}"
            >
              <ha-icon icon="hass:play"></ha-icon>
              ${localize('common.continue')}
            </paper-button>
            <paper-button @click="${this.handleVacuumAction('pause')}">
              <ha-icon icon="hass:pause"></ha-icon>
              ${localize('common.pause')}
            </paper-button>
          </div>
        `;
      }
      case 'docked':
      case 'idle':
      default: {
        const buttons = this.config.shortcuts.map(
          ({ name, service, icon, service_data, target }) => {
            const execute = () => {
              if (service) {
                return this.callService({ service, service_data, target });
              }
            };
            return html`
              <ha-icon-button label="${name}" @click="${execute}">
                <ha-icon icon="${icon}"></ha-icon>
              </ha-icon-button>
            `;
          },
        );

        const dockButton = html`
          <ha-icon-button
            label="${localize('common.return_to_base')}"
            @click="${this.handleVacuumAction('return_to_base')}"
            ><ha-icon icon="hass:home-map-marker"></ha-icon>
          </ha-icon-button>
        `;

        const selectedCount = this.selectedAreaIds.length;
        const hasOptions = this.visibleOptions.length > 0;
        const hasAreas = this.mappedAreaIds.length > 0;
        const areasButton =
          hasOptions || hasAreas
            ? html`
                <ha-icon-button
                  class="areas-toggle ${this.areasExpanded ? 'active' : ''}"
                  label="${localize(
                    hasAreas ? 'common.clean_areas' : 'common.cleaning_options',
                  )}"
                  @click="${() => this.toggleAreas()}"
                  ><ha-icon
                    icon="${hasAreas ? 'mdi:texture-box' : 'mdi:tune'}"
                  ></ha-icon>
                </ha-icon-button>
              `
            : nothing;

        return html`
          <div class="toolbar">
            <ha-icon-button
              class="start"
              label="${localize('common.start')}"
              @click="${() => this.handleStart()}"
              ><ha-icon icon="hass:play"></ha-icon>
              ${
                selectedCount > 0
                  ? html`<span class="badge">${selectedCount}</span>`
                  : nothing
              }
            </ha-icon-button>

            <ha-icon-button
              label="${localize('common.locate')}"
              @click="${this.handleVacuumAction('locate', { request: false })}"
              ><ha-icon icon="mdi:map-marker"></ha-icon>
            </ha-icon-button>

            ${state === 'idle' ? dockButton : ''} ${areasButton}
            <div class="fill-gap"></div>
            ${buttons}
          </div>
        `;
      }
    }
  }

  private renderOption({ entity, name }: VacuumCardOption): Template {
    const hass = this.hass as HomeAssistant & {
      formatEntityState?: (stateObj: HassEntity, state?: string) => string;
      formatEntityName?: (
        stateObj: HassEntity,
        type: { type: string },
      ) => string | undefined;
    };
    const stateObj = hass.states[entity];
    const choices: string[] = stateObj.attributes.options ?? [];
    const formatChoice = (choice: string) =>
      hass.formatEntityState?.(stateObj, choice) ?? choice;
    const label =
      name ||
      hass.formatEntityName?.(stateObj, { type: 'entity' }) ||
      stateObj.attributes.friendly_name ||
      entity;

    return html`
      <div class="option">
        <span class="option-name">${label}</span>
        <ha-dropdown
          placement="bottom-end"
          @wa-select=${(e: CustomEvent<{ item?: { value?: string } }>) =>
            this.handleOption(entity, e)}
        >
          <button class="option-trigger" slot="trigger" aria-label=${label}>
            <span>${formatChoice(stateObj.state)}</span>
            <ha-icon icon="mdi:menu-down"></ha-icon>
          </button>
          ${repeat(
            choices,
            (choice) => choice,
            (choice) => html`
              <ha-dropdown-item
                .value=${choice}
                ?checked=${choice === stateObj.state}
              >
                ${formatChoice(choice)}
              </ha-dropdown-item>
            `,
          )}
        </ha-dropdown>
      </div>
    `;
  }

  private renderAreas(state: VacuumEntityState): Template {
    if (
      !this.config.show_toolbar ||
      !this.areasExpanded ||
      !['docked', 'idle'].includes(state)
    ) {
      return nothing;
    }

    const options = this.visibleOptions;
    const sections = this.areaSections;
    if (options.length === 0 && sections.length === 0) {
      return nothing;
    }

    const showLabels = sections.length > 1;

    return html`
      <div class="areas">
        ${
          options.length > 0
            ? html`
                <div class="options">
                  ${options.map((option) => this.renderOption(option))}
                </div>
              `
            : nothing
        }
        ${sections.map(
          ({ floor, areas }) => html`
            ${
              showLabels
                ? html`
                    <div class="areas-floor">
                      <ha-icon
                        icon="${floor?.icon || 'mdi:floor-plan'}"
                      ></ha-icon>
                      ${floor?.name ?? localize('common.other_areas')}
                    </div>
                  `
                : nothing
            }
            <div class="areas-list">
              ${areas.map((area) => {
                const index = this.selectedAreaIds.indexOf(area.area_id);
                return html`
                  <button
                    class="area ${index >= 0 ? 'selected' : ''}"
                    aria-pressed="${index >= 0}"
                    @click="${() => this.toggleArea(area.area_id)}"
                  >
                    ${
                      index >= 0
                        ? html`<span class="badge">${index + 1}</span>`
                        : html`<ha-icon
                            icon="${area.icon || 'mdi:texture-box'}"
                          ></ha-icon>`
                    }
                    <span class="area-name">${area.name}</span>
                  </button>
                `;
              })}
            </div>
          `,
        )}
      </div>
    `;
  }

  private renderUnavailable(): Template {
    return html`
      <ha-card>
        <div class="preview not-available">
          <div class="metadata">
            <div class="not-available">
              ${localize('common.not_available')}
            </div>
          <div>
        </div>
      </ha-card>
    `;
  }

  protected render(): Template {
    if (!this.entity) {
      return this.renderUnavailable();
    }

    return html`
      <ha-card>
        <div class="preview">
          <div class="header">
            <div class="tips">
              ${this.renderSource()} ${this.renderBattery()}
            </div>
            <ha-icon-button
              class="more-info"
              icon="mdi:dots-vertical"
              ?more-info="true"
              @click="${() => this.handleMore()}"
              ><ha-icon icon="mdi:dots-vertical"></ha-icon
            ></ha-icon-button>
          </div>

          ${this.renderMapOrImage(this.entity.state)}

          <div class="metadata">
            ${this.renderName()} ${this.renderStatus()}
          </div>

          ${this.renderStats(this.entity.state)}
        </div>

        ${this.renderAreas(this.entity.state)}
        ${this.renderToolbar(this.entity.state)}
      </ha-card>
    `;
  }
}

declare global {
  interface Window {
    customCards?: unknown[];
  }
}

try {
  customElements.define('vacuum-card', VacuumCard);
} catch {
  console.warn(
    'vacuum-card is already registered. Reload the page to use the latest version.',
  );
}

window.customCards = window.customCards || [];
window.customCards.push({
  preview: true,
  type: 'vacuum-card',
  name: localize('common.name'),
  description: localize('common.description'),
});
