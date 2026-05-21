import type DatabaseType from "better-sqlite3";
import {
  DEFAULT_ENVIRONMENT_CAPABILITIES,
  DEFAULT_ENVIRONMENT_TRUST_CLASSES,
  DEFAULT_PHASE6_FEATURE_FLAGS,
  createEnvironmentRegistry,
  defaultEnvironmentTrustClass,
} from "../environment/registry";
import {
  CapabilitySchema,
  DeviceSchema,
  RoomSchema,
  TrustClassSchema,
  type Capability,
  type Device,
  type EnvironmentRegistry,
  type EnvironmentTrustClass,
  type Room,
  type TrustClass,
} from "../environment/types";

export interface EnvironmentRegistryMetadataRow {
  key: string;
  value: string;
  updated_at: number;
}

export interface EnvironmentRoomRow {
  id: string;
  display_name: string;
  kind: string;
}

export interface EnvironmentTrustClassRow {
  id: EnvironmentTrustClass;
  can_observe: number;
  can_mutate: number;
  requires_approval: number;
  notes: string | null;
}

export interface EnvironmentCapabilityRow {
  id: string;
  display_name: string;
  description: string | null;
  trust_class: EnvironmentTrustClass;
}

export interface EnvironmentDeviceRow {
  id: string;
  display_name: string;
  room_id: string;
  manufacturer: string | null;
  model: string | null;
  trust_class: EnvironmentTrustClass;
}

export interface UpsertEnvironmentRegistryMetadataInput {
  key: string;
  value: string;
  updatedAt?: number;
}

export interface InsertEnvironmentRoomInput {
  id: string;
  displayName: string;
  kind?: string;
}

export interface InsertEnvironmentCapabilityInput {
  id: string;
  displayName: string;
  description?: string | null;
  trustClass?: EnvironmentTrustClass;
}

export interface InsertEnvironmentDeviceInput {
  id: string;
  displayName: string;
  roomId: string;
  manufacturer?: string | null;
  model?: string | null;
  trustClass?: string | null;
  capabilities?: string[];
}

function requireTrimmed(value: string, label: string): string {
  const trimmed = value.trim();
  if (!trimmed) throw new Error(`${label} is required`);
  return trimmed;
}

function optionalTrimmed(value: string | null | undefined): string | null {
  const trimmed = value?.trim();
  return trimmed || null;
}

function boolToInt(value: boolean): number {
  return value ? 1 : 0;
}

function intToBool(value: number): boolean {
  return value === 1;
}

function roomToRow(room: Room): EnvironmentRoomRow {
  return {
    id: room.id,
    display_name: room.displayName,
    kind: room.kind,
  };
}

function roomFromRow(row: EnvironmentRoomRow): Room {
  return RoomSchema.parse({
    id: row.id,
    displayName: row.display_name,
    kind: row.kind,
  });
}

function trustClassToRow(trustClass: TrustClass): EnvironmentTrustClassRow {
  return {
    id: trustClass.id,
    can_observe: boolToInt(trustClass.canObserve),
    can_mutate: boolToInt(trustClass.canMutate),
    requires_approval: boolToInt(trustClass.requiresApproval),
    notes: optionalTrimmed(trustClass.notes),
  };
}

function trustClassFromRow(row: EnvironmentTrustClassRow): TrustClass {
  return TrustClassSchema.parse({
    id: row.id,
    canObserve: intToBool(row.can_observe),
    canMutate: intToBool(row.can_mutate),
    requiresApproval: intToBool(row.requires_approval),
    notes: row.notes ?? undefined,
  });
}

function capabilityToRow(capability: Capability): EnvironmentCapabilityRow {
  return {
    id: capability.id,
    display_name: capability.displayName,
    description: optionalTrimmed(capability.description),
    trust_class: capability.trustClass,
  };
}

function capabilityFromRow(row: EnvironmentCapabilityRow): Capability {
  return CapabilitySchema.parse({
    id: row.id,
    displayName: row.display_name,
    description: row.description ?? undefined,
    trustClass: row.trust_class,
  });
}

function deviceToRow(device: Device): EnvironmentDeviceRow {
  return {
    id: device.id,
    display_name: device.displayName,
    room_id: device.roomId,
    manufacturer: optionalTrimmed(device.manufacturer),
    model: optionalTrimmed(device.model),
    trust_class: device.trustClass,
  };
}

function deviceFromRow(
  row: EnvironmentDeviceRow,
  capabilities: string[],
): Device {
  return DeviceSchema.parse({
    id: row.id,
    displayName: row.display_name,
    roomId: row.room_id,
    manufacturer: row.manufacturer ?? undefined,
    model: row.model ?? undefined,
    trustClass: row.trust_class,
    capabilities,
  });
}

export function upsertEnvironmentRegistryMetadata(
  db: DatabaseType.Database,
  input: UpsertEnvironmentRegistryMetadataInput,
): EnvironmentRegistryMetadataRow {
  const row: EnvironmentRegistryMetadataRow = {
    key: requireTrimmed(input.key, "key"),
    value: requireTrimmed(input.value, "value"),
    updated_at: input.updatedAt ?? Date.now(),
  };

  db.prepare(
    `INSERT INTO environment_registry_metadata (key, value, updated_at)
     VALUES (?, ?, ?)
     ON CONFLICT(key) DO UPDATE SET
       value = excluded.value,
       updated_at = excluded.updated_at`,
  ).run(row.key, row.value, row.updated_at);

  return row;
}

export function getEnvironmentRegistryMetadata(
  db: DatabaseType.Database,
  key: string,
): EnvironmentRegistryMetadataRow | undefined {
  return db
    .prepare("SELECT * FROM environment_registry_metadata WHERE key = ?")
    .get(requireTrimmed(key, "key")) as
    | EnvironmentRegistryMetadataRow
    | undefined;
}

export function listEnvironmentRegistryMetadata(
  db: DatabaseType.Database,
): EnvironmentRegistryMetadataRow[] {
  return db
    .prepare("SELECT * FROM environment_registry_metadata ORDER BY key ASC")
    .all() as EnvironmentRegistryMetadataRow[];
}

export function upsertEnvironmentTrustClass(
  db: DatabaseType.Database,
  input: TrustClass,
): EnvironmentTrustClassRow {
  const row = trustClassToRow(TrustClassSchema.parse(input));
  db.prepare(
    `INSERT INTO environment_trust_class (
       id, can_observe, can_mutate, requires_approval, notes
     ) VALUES (?, ?, ?, ?, ?)
     ON CONFLICT(id) DO UPDATE SET
       can_observe = excluded.can_observe,
       can_mutate = excluded.can_mutate,
       requires_approval = excluded.requires_approval,
       notes = excluded.notes`,
  ).run(
    row.id,
    row.can_observe,
    row.can_mutate,
    row.requires_approval,
    row.notes,
  );
  return row;
}

export function listEnvironmentTrustClasses(
  db: DatabaseType.Database,
): TrustClass[] {
  return (
    db
      .prepare("SELECT * FROM environment_trust_class ORDER BY id ASC")
      .all() as EnvironmentTrustClassRow[]
  ).map(trustClassFromRow);
}

export function insertEnvironmentRoom(
  db: DatabaseType.Database,
  input: InsertEnvironmentRoomInput,
): EnvironmentRoomRow {
  const room = RoomSchema.parse({
    id: input.id,
    displayName: input.displayName,
    kind: input.kind ?? "room",
  });
  const row = roomToRow(room);
  db.prepare(
    `INSERT INTO environment_room (id, display_name, kind)
     VALUES (?, ?, ?)`,
  ).run(row.id, row.display_name, row.kind);
  return row;
}

export function updateEnvironmentRoom(
  db: DatabaseType.Database,
  input: InsertEnvironmentRoomInput,
): Room | undefined {
  const room = RoomSchema.parse({
    id: input.id,
    displayName: input.displayName,
    kind: input.kind ?? "room",
  });
  const row = roomToRow(room);
  db.prepare(
    `UPDATE environment_room
     SET display_name = ?,
         kind = ?
     WHERE id = ?`,
  ).run(row.display_name, row.kind, row.id);
  return getEnvironmentRoom(db, row.id);
}

export function getEnvironmentRoom(
  db: DatabaseType.Database,
  id: string,
): Room | undefined {
  const row = db
    .prepare("SELECT * FROM environment_room WHERE id = ?")
    .get(requireTrimmed(id, "id")) as EnvironmentRoomRow | undefined;
  return row ? roomFromRow(row) : undefined;
}

export function listEnvironmentRooms(db: DatabaseType.Database): Room[] {
  return (
    db
      .prepare(
        "SELECT * FROM environment_room ORDER BY display_name ASC, id ASC",
      )
      .all() as EnvironmentRoomRow[]
  ).map(roomFromRow);
}

export function insertEnvironmentCapability(
  db: DatabaseType.Database,
  input: InsertEnvironmentCapabilityInput,
): EnvironmentCapabilityRow {
  const capability = CapabilitySchema.parse({
    id: input.id,
    displayName: input.displayName,
    description: input.description ?? undefined,
    trustClass: input.trustClass ?? "observe-only",
  });
  const row = capabilityToRow(capability);
  db.prepare(
    `INSERT INTO environment_capability (
       id, display_name, description, trust_class
     ) VALUES (?, ?, ?, ?)`,
  ).run(row.id, row.display_name, row.description, row.trust_class);
  return row;
}

export function updateEnvironmentCapability(
  db: DatabaseType.Database,
  input: InsertEnvironmentCapabilityInput,
): Capability | undefined {
  const capability = CapabilitySchema.parse({
    id: input.id,
    displayName: input.displayName,
    description: input.description ?? undefined,
    trustClass: input.trustClass ?? "observe-only",
  });
  const row = capabilityToRow(capability);
  db.prepare(
    `UPDATE environment_capability
     SET display_name = ?,
         description = ?,
         trust_class = ?
     WHERE id = ?`,
  ).run(row.display_name, row.description, row.trust_class, row.id);
  return getEnvironmentCapability(db, row.id);
}

export function getEnvironmentCapability(
  db: DatabaseType.Database,
  id: string,
): Capability | undefined {
  const row = db
    .prepare("SELECT * FROM environment_capability WHERE id = ?")
    .get(requireTrimmed(id, "id")) as EnvironmentCapabilityRow | undefined;
  return row ? capabilityFromRow(row) : undefined;
}

export function listEnvironmentCapabilities(
  db: DatabaseType.Database,
): Capability[] {
  return (
    db
      .prepare(
        "SELECT * FROM environment_capability ORDER BY display_name ASC, id ASC",
      )
      .all() as EnvironmentCapabilityRow[]
  ).map(capabilityFromRow);
}

export function insertEnvironmentDevice(
  db: DatabaseType.Database,
  input: InsertEnvironmentDeviceInput,
): EnvironmentDeviceRow {
  const device = DeviceSchema.parse({
    id: input.id,
    displayName: input.displayName,
    roomId: input.roomId,
    manufacturer: input.manufacturer ?? undefined,
    model: input.model ?? undefined,
    trustClass: defaultEnvironmentTrustClass(input.trustClass),
    capabilities: input.capabilities ?? [],
  });
  const row = deviceToRow(device);

  const insert = db.transaction(() => {
    db.prepare(
      `INSERT INTO environment_device (
         id, display_name, room_id, manufacturer, model, trust_class
       ) VALUES (?, ?, ?, ?, ?, ?)`,
    ).run(
      row.id,
      row.display_name,
      row.room_id,
      row.manufacturer,
      row.model,
      row.trust_class,
    );

    const insertCapability = db.prepare(
      `INSERT INTO environment_device_capability (device_id, capability_id)
       VALUES (?, ?)`,
    );
    for (const capability of device.capabilities) {
      insertCapability.run(device.id, capability);
    }
  });
  insert();

  return row;
}

export function updateEnvironmentDevice(
  db: DatabaseType.Database,
  input: InsertEnvironmentDeviceInput,
): Device | undefined {
  const device = DeviceSchema.parse({
    id: input.id,
    displayName: input.displayName,
    roomId: input.roomId,
    manufacturer: input.manufacturer ?? undefined,
    model: input.model ?? undefined,
    trustClass: defaultEnvironmentTrustClass(input.trustClass),
    capabilities: input.capabilities ?? [],
  });
  const row = deviceToRow(device);

  const update = db.transaction(() => {
    db.prepare(
      `UPDATE environment_device
       SET display_name = ?,
           room_id = ?,
           manufacturer = ?,
           model = ?,
           trust_class = ?
       WHERE id = ?`,
    ).run(
      row.display_name,
      row.room_id,
      row.manufacturer,
      row.model,
      row.trust_class,
      row.id,
    );
    db.prepare(
      "DELETE FROM environment_device_capability WHERE device_id = ?",
    ).run(row.id);
    const insertCapability = db.prepare(
      `INSERT INTO environment_device_capability (device_id, capability_id)
       VALUES (?, ?)`,
    );
    for (const capability of device.capabilities) {
      insertCapability.run(device.id, capability);
    }
  });
  update();

  return getEnvironmentDevice(db, row.id);
}

function listDeviceCapabilities(
  db: DatabaseType.Database,
  deviceId: string,
): string[] {
  return (
    db
      .prepare(
        `SELECT capability_id
         FROM environment_device_capability
         WHERE device_id = ?
         ORDER BY capability_id ASC`,
      )
      .all(deviceId) as Array<{ capability_id: string }>
  ).map((row) => row.capability_id);
}

export function getEnvironmentDevice(
  db: DatabaseType.Database,
  id: string,
): Device | undefined {
  const row = db
    .prepare("SELECT * FROM environment_device WHERE id = ?")
    .get(requireTrimmed(id, "id")) as EnvironmentDeviceRow | undefined;
  return row
    ? deviceFromRow(row, listDeviceCapabilities(db, row.id))
    : undefined;
}

export function listEnvironmentDevices(db: DatabaseType.Database): Device[] {
  return (
    db
      .prepare(
        "SELECT * FROM environment_device ORDER BY display_name ASC, id ASC",
      )
      .all() as EnvironmentDeviceRow[]
  ).map((row) => deviceFromRow(row, listDeviceCapabilities(db, row.id)));
}

export function seedEnvironmentRegistryDefaults(
  db: DatabaseType.Database,
  input: { updatedAt?: number } = {},
): void {
  for (const trustClass of DEFAULT_ENVIRONMENT_TRUST_CLASSES) {
    upsertEnvironmentTrustClass(db, trustClass);
  }

  for (const capability of DEFAULT_ENVIRONMENT_CAPABILITIES) {
    const existing = getEnvironmentCapability(db, capability.id);
    if (!existing) {
      insertEnvironmentCapability(db, capability);
    }
  }

  upsertEnvironmentRegistryMetadata(db, {
    key: "schema_version",
    value: "1",
    updatedAt: input.updatedAt,
  });
}

export function getEnvironmentRegistry(
  db: DatabaseType.Database,
): EnvironmentRegistry {
  return createEnvironmentRegistry({
    rooms: listEnvironmentRooms(db),
    devices: listEnvironmentDevices(db),
    capabilities: listEnvironmentCapabilities(db),
    trustClasses: listEnvironmentTrustClasses(db),
    disabledFeatures: DEFAULT_PHASE6_FEATURE_FLAGS,
  });
}
