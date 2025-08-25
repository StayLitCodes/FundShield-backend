import { InMemoryCache } from '../in-memory-cache';

describe('InMemoryCache', () => {
  let cache: InMemoryCache;

  beforeEach(() => {
    cache = new InMemoryCache();
  });


  it('should set and get values', () => {
    cache.set('foo', 'bar');
    expect(cache.get('foo')).toBe('bar');
  });

  it('should overwrite existing values', () => {
    cache.set('foo', 'bar');
    cache.set('foo', 'baz');
    expect(cache.get('foo')).toBe('baz');
  });

  it('should support different value types', () => {
    cache.set('num', 123);
    cache.set('obj', { a: 1 });
    expect(cache.get('num')).toBe(123);
    expect(cache.get('obj')).toEqual({ a: 1 });
  });

  it('should report presence of keys', () => {
    cache.set('foo', 'bar');
    expect(cache.has('foo')).toBe(true);
    expect(cache.has('missing')).toBe(false);
  });

  it('should track cache size', () => {
    // @ts-ignore: access private for test
    expect(cache.cache.size).toBe(0);
    cache.set('a', 1);
    cache.set('b', 2);
    // @ts-ignore: access private for test
    expect(cache.cache.size).toBe(2);
    cache.delete('a');
    // @ts-ignore: access private for test
    expect(cache.cache.size).toBe(1);
    cache.clear();
    // @ts-ignore: access private for test
    expect(cache.cache.size).toBe(0);
  });

  it('should return undefined for missing keys', () => {
    expect(cache.get('missing')).toBeUndefined();
  });

  it('should delete values', () => {
    cache.set('foo', 'bar');
    cache.delete('foo');
    expect(cache.get('foo')).toBeUndefined();
  });

  it('should clear all values', () => {
    cache.set('a', 1);
    cache.set('b', 2);
    cache.clear();
    expect(cache.get('a')).toBeUndefined();
    expect(cache.get('b')).toBeUndefined();
  });
});
