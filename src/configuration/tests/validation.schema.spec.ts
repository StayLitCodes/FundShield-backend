import { JoiValidationSchema } from '../validation.schema';
import * as Joi from 'joi';

describe('JoiValidationSchema', () => {
  it('should validate correct env', () => {
    const env = { NODE_ENV: 'production', PORT: 4000 };
    const { error } = JoiValidationSchema.validate(env);
    expect(error).toBeUndefined();
  });

  it('should fail for invalid env', () => {
    const env = { NODE_ENV: 'invalid', PORT: 'not-a-number' };
    const { error } = JoiValidationSchema.validate(env);
    expect(error).toBeDefined();
  });
});
