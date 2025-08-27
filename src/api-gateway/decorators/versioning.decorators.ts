import { SetMetadata } from '@nestjs/common';

// Metadata keys
export const API_VERSION_KEY = 'api_version';
export const VERSION_NEUTRAL_KEY = 'version_neutral';
export const DEPRECATED_VERSION_KEY = 'deprecated_version';

/**
 * Decorator to set API version for a controller or method
 */
export const ApiVersion = (version: string | string[]) => {
  const versions = Array.isArray(version) ? version : [version];
  return SetMetadata(API_VERSION_KEY, versions);
};

/**
 * Decorator to mark a controller or method as version-neutral
 * Version-neutral endpoints are available in all API versions
 */
export const VersionNeutral = () => SetMetadata(VERSION_NEUTRAL_KEY, true);

/**
 * Decorator to mark a version as deprecated
 */
export const DeprecatedVersion = (version: string, deprecationDate?: Date, sunsetDate?: Date) => {
  return SetMetadata(DEPRECATED_VERSION_KEY, {
    version,
    deprecationDate,
    sunsetDate,
  });
};

/**
 * Decorator for version-specific method implementation
 */
export const VersionedEndpoint = (versions: string[]) => {
  return (target: any, propertyKey: string, descriptor: PropertyDescriptor) => {
    SetMetadata(API_VERSION_KEY, versions)(target, propertyKey, descriptor);
    
    // Store original method
    const originalMethod = descriptor.value;
    
    // Wrap method with version checking
    descriptor.value = function (...args: any[]) {
      const req = args.find(arg => arg && arg.headers);
      if (req) {
        req['_versionedEndpoint'] = {
          versions,
          method: propertyKey,
        };
      }
      
      return originalMethod.apply(this, args);
    };
    
    return descriptor;
  };
};

/**
 * Method decorator for handling multiple version implementations
 */
export const HandleVersions = (versionMap: Record<string, string>) => {
  return (target: any, propertyKey: string, descriptor: PropertyDescriptor) => {
    const originalMethod = descriptor.value;
    
    descriptor.value = function (...args: any[]) {
      const req = args.find(arg => arg && arg.headers);
      if (req && req.apiVersion) {
        const handlerMethod = versionMap[req.apiVersion];
        if (handlerMethod && this[handlerMethod]) {
          return this[handlerMethod].apply(this, args);
        }
      }
      
      return originalMethod.apply(this, args);
    };
    
    return descriptor;
  };
};

/**
 * Parameter decorator to inject API version into method parameters
 */
export const Version = () => {
  return (target: any, propertyKey: string, parameterIndex: number) => {
    const existingVersionParamIndexes = Reflect.getMetadata('version_param_indexes', target, propertyKey) || [];
    existingVersionParamIndexes.push(parameterIndex);
    Reflect.defineMetadata('version_param_indexes', existingVersionParamIndexes, target, propertyKey);
  };
};