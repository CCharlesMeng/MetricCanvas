import {versionPolicy} from './version';
import {supportsNativePreparation,NATIVE_IOC_SCHEMA_MINOR} from './native-preparation-capability';

/** Routine edits cannot opt an older document into new execution semantics. */
export function compatibleWriteVersion(document:{schemaVersion:string}):string {
  return supportsNativePreparation(document)?versionPolicy.current:`6.${Math.min(versionPolicy.minor,NATIVE_IOC_SCHEMA_MINOR-1)}`;
}
