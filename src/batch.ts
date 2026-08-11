import type { OBSBatchRequest, OBSBatchResponse, OBSRequestStatus } from './types.js'

/**
 * Describes the entries a batch may contain: a map of entry kind to the caller's metadata for that
 * entry and the payload OBS returns for it. `obs-websocket` batches are heterogeneous, so this is
 * the only place the correlation between a request and its response shape can be expressed.
 */
export type BatchSpec = Record<string, { meta: unknown; payload: unknown }>

/**
 * A resolved batch entry, discriminated on `kind` so a `switch` narrows both the metadata and the
 * response payload.
 */
export type BatchEntry<TSpec extends BatchSpec> = {
	[K in keyof TSpec]: {
		kind: K
		meta: TSpec[K]['meta']
		requestStatus: OBSRequestStatus
		responseData?: TSpec[K]['payload']
	}
}[keyof TSpec]

/** A {@link BatchEntry} that succeeded, so its payload is known to be present. */
export type SuccessfulBatchEntry<TSpec extends BatchSpec> = {
	[K in keyof TSpec]: {
		kind: K
		meta: TSpec[K]['meta']
		requestStatus: OBSRequestStatus
		responseData: TSpec[K]['payload']
	}
}[keyof TSpec]

/**
 * OBS reports per-request failures inside an otherwise successful batch, and a request can succeed
 * with no payload, so both are checked before an entry is treated as usable data.
 *
 * Returns the narrowed entry rather than acting as a type predicate: for a single-entry spec
 * `BatchEntry` is not a union, and narrowing it would produce an intersection that keeps
 * `responseData` optional.
 */
export function successfulEntry<TSpec extends BatchSpec>(
	entry: BatchEntry<TSpec>,
): SuccessfulBatchEntry<TSpec> | undefined {
	if (!entry.requestStatus.result || entry.responseData === undefined) return undefined
	// The check above is what makes `responseData` present; the compiler cannot carry that across the
	// two mapped types.
	return entry as SuccessfulBatchEntry<TSpec>
}

type PendingEntry = {
	kind: string
	meta: unknown
	optional: boolean
}

/**
 * Builds an OBS request batch, keeping each request's meaning in a typed side map instead of
 * encoding it into the request ID. Request IDs are opaque indices, which makes them unique by
 * construction (the same source may legitimately be asked about twice) and lets unrelated request
 * kinds share a single batch.
 */
export class BatchBuilder<TSpec extends BatchSpec> {
	private readonly _requests: OBSBatchRequest[] = []
	private readonly entries = new Map<string, PendingEntry>()

	/**
	 * `optional` marks a request the module knowingly issues on spec — asking every input for audio
	 * properties is cheaper than first discovering which ones have audio — so its failure is expected
	 * and not worth logging.
	 */
	public add<K extends keyof TSpec & string>(
		kind: K,
		requestType: string,
		requestData: Record<string, unknown> | undefined,
		meta: TSpec[K]['meta'],
		optional: boolean,
	): void {
		const requestId = String(this._requests.length)
		this._requests.push({ requestType, requestData, requestId })
		this.entries.set(requestId, { kind, meta, optional })
	}

	public get requests(): OBSBatchRequest[] {
		return this._requests
	}

	public isOptional(requestId: string): boolean {
		return this.entries.get(requestId)?.optional ?? false
	}

	/** Pairs each response with the metadata recorded for it, dropping any ID we did not send. */
	public resolve(responses: OBSBatchResponse[]): BatchEntry<TSpec>[] {
		const resolved: BatchEntry<TSpec>[] = []
		for (const response of responses) {
			const entry = this.entries.get(response.requestId)
			if (!entry) continue
			resolved.push({
				kind: entry.kind,
				meta: entry.meta,
				requestStatus: response.requestStatus,
				responseData: response.responseData,
			})
		}
		return resolved
	}
}
