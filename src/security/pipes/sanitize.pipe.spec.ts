import { SanitizePipe } from './sanitize.pipe';

describe('SanitizePipe', () => {
  let pipe: SanitizePipe;

  beforeEach(() => {
    pipe = new SanitizePipe();
  });

  it('should sanitize XSS from string', () => {
    const input = '<img src=x onerror=alert(1) />';
    const result = pipe.transform(input, { type: 'body' } as any);
    expect(result).not.toContain('onerror');
    expect(result).not.toContain('<img'); // DOMPurify strips tags by default
  });

  it('should remove SQLi patterns from string', () => {
    const input = "Robert'); DROP TABLE Students;--";
    const result = pipe.transform(input, { type: 'body' } as any);
    expect(result).not.toContain("'");
    expect(result).not.toContain(';');
    expect(result).not.toContain('--');
  });

  it('should recursively sanitize objects', () => {
    const input = {
      name: "<script>alert('x')</script>",
      comment: "Robert'); DROP TABLE Students;--",
      nested: { field: '<img src=x onerror=alert(1) />' },
    };
    const result = pipe.transform(input, { type: 'body' } as any);
    expect(result.name).not.toContain('<script>');
    expect(result.comment).not.toContain("'");
    expect(result.nested.field).not.toContain('onerror');
  });

  it('should sanitize arrays', () => {
    const input = ["<img src=x onerror=alert(1) />", "Robert'); DROP TABLE Students;--"];
    const result = pipe.transform(input, { type: 'body' } as any);
    expect(result[0]).not.toContain('onerror');
    expect(result[1]).not.toContain("'");
  });
}); 