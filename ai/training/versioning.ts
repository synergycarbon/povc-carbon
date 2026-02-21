/**
 * Model Version Management with Rollback
 *
 * Tracks model checkpoints as scatter-cas blobs with content-addressed hashes.
 * Supports promotion, rollback, and lineage queries. Governance SmartCircuit
 * can pause a model version if anomaly detected.
 *
 * Version format: v{major}.{minor}.{patch}-{timestamp}
 */

import type { ModelCheckpoint } from '../yield-forecaster/model';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface ModelVersion {
  version: string;
  major: number;
  minor: number;
  patch: number;
  created_at: number;
  status: 'candidate' | 'active' | 'retired' | 'paused' | 'rolled_back';
  checkpoint_hash: Uint8Array;
  parent_version: string | null;
  promotion_reason: string | null;
  rollback_reason: string | null;
}

export interface VersionLineage {
  current: string;
  history: ModelVersion[];
  rollback_count: number;
}

// ---------------------------------------------------------------------------
// Version Manager
// ---------------------------------------------------------------------------

export class ModelVersionManager {
  private versions: Map<string, ModelVersion> = new Map();
  private checkpoints: Map<string, ModelCheckpoint> = new Map();
  private active_version: string | null = null;
  private version_counter = { major: 1, minor: 0, patch: 0 };

  next_version(): ModelVersion {
    this.version_counter.patch++;

    const version_str = `v${this.version_counter.major}.${this.version_counter.minor}.${this.version_counter.patch}-${Date.now()}`;

    return {
      version: version_str,
      major: this.version_counter.major,
      minor: this.version_counter.minor,
      patch: this.version_counter.patch,
      created_at: Math.floor(Date.now() / 1000),
      status: 'candidate',
      checkpoint_hash: new Uint8Array(32),
      parent_version: this.active_version,
      promotion_reason: null,
      rollback_reason: null,
    };
  }

  register(version: ModelVersion, checkpoint: ModelCheckpoint): void {
    this.versions.set(version.version, version);
    this.checkpoints.set(version.version, checkpoint);
  }

  promote(version_id: string, reason: string = 'accuracy_improvement'): boolean {
    const version = this.versions.get(version_id);
    if (!version) return false;

    if (this.active_version) {
      const current = this.versions.get(this.active_version);
      if (current) {
        current.status = 'retired';
      }
    }

    version.status = 'active';
    version.promotion_reason = reason;
    this.active_version = version_id;
    return true;
  }

  rollback(reason: string = 'degradation_detected'): ModelCheckpoint | null {
    if (!this.active_version) return null;

    const current = this.versions.get(this.active_version);
    if (!current || !current.parent_version) return null;

    current.status = 'rolled_back';
    current.rollback_reason = reason;

    const parent = this.versions.get(current.parent_version);
    if (!parent) return null;

    parent.status = 'active';
    this.active_version = current.parent_version;

    return this.checkpoints.get(current.parent_version) ?? null;
  }

  pause(version_id: string, reason: string = 'anomaly_detected'): boolean {
    const version = this.versions.get(version_id);
    if (!version) return false;

    version.status = 'paused';
    version.rollback_reason = reason;

    if (this.active_version === version_id) {
      if (version.parent_version) {
        const parent = this.versions.get(version.parent_version);
        if (parent) {
          parent.status = 'active';
          this.active_version = version.parent_version;
        }
      } else {
        this.active_version = null;
      }
    }

    return true;
  }

  get_active(): { version: ModelVersion; checkpoint: ModelCheckpoint } | null {
    if (!this.active_version) return null;

    const version = this.versions.get(this.active_version);
    const checkpoint = this.checkpoints.get(this.active_version);

    if (!version || !checkpoint) return null;
    return { version, checkpoint };
  }

  get_version(version_id: string): ModelVersion | null {
    return this.versions.get(version_id) ?? null;
  }

  get_checkpoint(version_id: string): ModelCheckpoint | null {
    return this.checkpoints.get(version_id) ?? null;
  }

  get_lineage(): VersionLineage {
    const history = [...this.versions.values()]
      .sort((a, b) => b.created_at - a.created_at);

    const rollback_count = history.filter(v => v.status === 'rolled_back').length;

    return {
      current: this.active_version ?? 'none',
      history,
      rollback_count,
    };
  }

  list_versions(status?: ModelVersion['status']): ModelVersion[] {
    const all = [...this.versions.values()];
    if (status) return all.filter(v => v.status === status);
    return all.sort((a, b) => b.created_at - a.created_at);
  }
}
