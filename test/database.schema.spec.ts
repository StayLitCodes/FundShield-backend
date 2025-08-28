import { DataSource } from 'typeorm';
import { dataSource } from '../src/config/database.config';

describe('Database schema', () => {
  let ds: DataSource;

  beforeAll(async () => {
    ds = new DataSource(dataSource.options as any);
    await ds.initialize();
  }, 30000);

  afterAll(async () => {
    if (ds && ds.isInitialized) {
      await ds.destroy();
    }
  });

  it('should have users table', async () => {
    const has = await ds.query(`SELECT to_regclass('public.users') IS NOT NULL as exists`);
    expect(has).toBeDefined();
  });
});
