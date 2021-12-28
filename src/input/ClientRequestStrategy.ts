export interface ClientRequestStrategy {
	runStrategy(): Promise<void>;
}

export class ParallelStrategy implements ClientRequestStrategy {
	public async runStrategy(): Promise<void> {
		throw new Error("Not implemented yet");
	}
}

export class SequentiallyStrategy implements ClientRequestStrategy {
	public async runStrategy(): Promise<void> {
		throw new Error("Not implemented yet");
	}
}
