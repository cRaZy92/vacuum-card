import {
  HassEntityAttributeBase,
  HassEntityBase,
  HassServiceTarget,
} from 'home-assistant-js-websocket';
import { TemplateResult, nothing } from 'lit';

export * from 'home-assistant-js-websocket';

export type TemplateNothing = typeof nothing;
export type Template = TemplateResult | TemplateNothing;

export type VacuumEntityState =
  | 'cleaning'
  | 'docked'
  | 'idle'
  | 'paused'
  | 'returning'
  | 'error'
  | 'unknown'
  | string; // for other states

export interface VacuumEntityAttributes extends HassEntityAttributeBase {
  status?: VacuumEntityState;
  state?: VacuumEntityState;
  fan_speed?: string;
  fan_speed_list?: string[];
  battery_level?: number;
  battery_icon?: string;
  supported_features?: number;
}

export interface VacuumEntity extends HassEntityBase {
  attributes: VacuumEntityAttributes;
  state: VacuumEntityState;
}

export interface VacuumBatteryEntity extends HassEntityBase {
  attributes: HassEntityAttributeBase;
}

export interface VacuumArea {
  area_id: string;
  name: string;
  icon?: string | null;
  floor_id?: string | null;
}

export interface VacuumFloor {
  floor_id: string;
  name: string;
  icon?: string | null;
}

export interface VacuumSegment {
  id: string;
  name: string;
  group?: string | null;
}

export interface VacuumAreaSection {
  floor: VacuumFloor | null;
  areas: VacuumArea[];
}

export interface VacuumCardStat {
  entity_id?: string;
  attribute?: string;
  value_template?: string;
  unit?: string;
  subtitle?: string;
}

export interface VacuumCardAction {
  service: string;
  service_data?: Record<string, unknown>;
  target?: HassServiceTarget;
}

export interface VacuumCardShortcut {
  name?: string;
  icon?: string;
  service?: string;
  service_data?: Record<string, unknown>;
  target?: HassServiceTarget;
}

export interface VacuumCardOptionCondition {
  entity: string;
  state?: string | string[];
  state_not?: string | string[];
}

export interface VacuumCardOption {
  entity: string;
  name?: string;
  visible_when?: VacuumCardOptionCondition;
}

export interface VacuumCardAreaPreset {
  name: string;
  icon?: string;
  areas: string[];
}

// Rooms sent to the vacuum by this card, kept to show them during the run
export interface VacuumCleaningRun {
  areas: string[];
  started: number;
  active: boolean;
  idleSince?: number;
}

export interface VacuumCardConfig {
  entity: string;
  battery_entity: string;
  map: string;
  map_refresh: number;
  map_entity: string;
  map_areas: Record<string, string[]>;
  image: string;
  show_name: boolean;
  show_status: boolean;
  show_toolbar: boolean;
  show_areas: boolean;
  expand_areas: boolean;
  compact_view: boolean;
  stats: Record<string, VacuumCardStat[]>;
  actions: Record<string, VacuumCardAction>;
  shortcuts: VacuumCardShortcut[];
  options: VacuumCardOption[];
  area_presets: VacuumCardAreaPreset[];
}

export interface VacuumServiceCallParams {
  request: boolean;
}

export interface VacuumActionParams extends VacuumServiceCallParams {
  defaultService?: string;
}
