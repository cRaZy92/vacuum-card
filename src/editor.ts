import { LitElement, html, nothing } from 'lit';
import {
  HomeAssistant,
  LovelaceCardConfig,
  LovelaceCardEditor,
  fireEvent,
} from 'custom-card-helpers';
import localize from './localize';
import { property, state } from 'lit/decorators.js';
import { Template, VacuumCardConfig } from './types';
import styles from './editor.css';

type ConfigElement = HTMLInputElement & {
  configValue?: keyof VacuumCardConfig;
};

export class VacuumCardEditor extends LitElement implements LovelaceCardEditor {
  @property({ attribute: false }) public hass?: HomeAssistant;

  @state() private config!: Partial<VacuumCardConfig>;

  setConfig(config: LovelaceCardConfig & VacuumCardConfig): void {
    this.config = config;

    if (!this.config.entity && this.hass) {
      this.config.entity =
        Object.keys(this.hass.states).find((id) => id.startsWith('vacuum')) ||
        '';
      fireEvent(this, 'config-changed', { config: this.config });
    }
  }

  protected render(): Template {
    if (!this.hass || !this.config) {
      return nothing;
    }

    return html`
      <div class="card-config">
        <div class="option">
          <ha-selector
            .hass=${this.hass}
            .selector=${{ entity: { domain: 'vacuum' } }}
            .value=${this.config.entity}
            .label=${localize('editor.entity')}
            .required=${true}
            @value-changed=${(e: CustomEvent) =>
              this.selectorChanged(e, 'entity')}
          ></ha-selector>
        </div>

        <div class="option">
          <ha-selector
            .hass=${this.hass}
            .selector=${{ entity: { domain: 'sensor' } }}
            .value=${this.config.battery_entity}
            .label=${localize('editor.battery_entity')}
            .required=${false}
            @value-changed=${(e: CustomEvent) =>
              this.selectorChanged(e, 'battery_entity')}
          ></ha-selector>
        </div>

        <div class="option">
          <ha-selector
            .hass=${this.hass}
            .selector=${{ entity: { domain: ['camera', 'image'] } }}
            .value=${this.config.map}
            .label=${localize('editor.map')}
            .required=${false}
            @value-changed=${(e: CustomEvent) => this.selectorChanged(e, 'map')}
          ></ha-selector>
        </div>

        <div class="option">
          <ha-selector
            .hass=${this.hass}
            .selector=${{ entity: { domain: ['select', 'input_select'] } }}
            .value=${this.config.map_entity}
            .label=${localize('editor.map_entity')}
            .required=${false}
            @value-changed=${(e: CustomEvent) =>
              this.selectorChanged(e, 'map_entity')}
          ></ha-selector>
        </div>

        <div class="option">
          <paper-input
            label="${localize('editor.image')}"
            .value=${this.config.image}
            .configValue=${'image'}
            @value-changed=${this.valueChanged}
          ></paper-input>
        </div>

        <div class="option">
          <ha-selector
            .hass=${this.hass}
            .selector=${{ boolean: {} }}
            .value=${this.config.compact_view ?? false}
            .label=${localize('editor.compact_view')}
            @value-changed=${(e: CustomEvent) =>
              this.selectorChanged(e, 'compact_view')}
          ></ha-selector>
        </div>

        <div class="option">
          <ha-selector
            .hass=${this.hass}
            .selector=${{ boolean: {} }}
            .value=${this.config.show_name ?? true}
            .label=${localize('editor.show_name')}
            @value-changed=${(e: CustomEvent) =>
              this.selectorChanged(e, 'show_name')}
          ></ha-selector>
        </div>

        <div class="option">
          <ha-selector
            .hass=${this.hass}
            .selector=${{ boolean: {} }}
            .value=${this.config.show_status ?? true}
            .label=${localize('editor.show_status')}
            @value-changed=${(e: CustomEvent) =>
              this.selectorChanged(e, 'show_status')}
          ></ha-selector>
        </div>

        <div class="option">
          <ha-selector
            .hass=${this.hass}
            .selector=${{ boolean: {} }}
            .value=${this.config.show_toolbar ?? true}
            .label=${localize('editor.show_toolbar')}
            @value-changed=${(e: CustomEvent) =>
              this.selectorChanged(e, 'show_toolbar')}
          ></ha-selector>
        </div>

        <strong>${localize('editor.code_only_note')}</strong>
      </div>
    `;
  }

  private selectorChanged(
    event: CustomEvent,
    configKey: keyof VacuumCardConfig,
  ): void {
    const value = event.detail?.value ?? '';
    if (this.config[configKey] === value) {
      return;
    }
    if (value === '') {
      const rest = { ...this.config };
      delete rest[configKey];
      this.config = rest;
    } else {
      this.config = { ...this.config, [configKey]: value };
    }
    fireEvent(this, 'config-changed', { config: this.config });
  }

  private valueChanged(event: Event): void {
    if (!this.config || !this.hass || !event.target) {
      return;
    }
    const target = event.target as ConfigElement;
    if (
      !target.configValue ||
      this.config[target.configValue] === target?.value
    ) {
      return;
    }
    if (target.configValue) {
      if (target.value === '') {
        delete this.config[target.configValue];
      } else {
        this.config = {
          ...this.config,
          [target.configValue]:
            target.checked !== undefined ? target.checked : target.value,
        };
      }
    }
    fireEvent(this, 'config-changed', { config: this.config });
  }

  static get styles() {
    return styles;
  }
}

try {
  customElements.define('vacuum-card-editor', VacuumCardEditor);
} catch {
  console.warn(
    'vacuum-card-editor is already registered. Reload the page to use the latest version.',
  );
}
