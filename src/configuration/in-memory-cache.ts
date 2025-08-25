// Simple in-memory cache utility for configuration and feature flags
export class InMemoryCache<T = any> {
	private cache = new Map<string, T>();

	get(key: string): T | undefined {
		return this.cache.get(key);
	}

	set(key: string, value: T): void {
		this.cache.set(key, value);
	}

	has(key: string): boolean {
		return this.cache.has(key);
	}

	delete(key: string): void {
		this.cache.delete(key);
	}

	clear(): void {
		this.cache.clear();
	}
}
