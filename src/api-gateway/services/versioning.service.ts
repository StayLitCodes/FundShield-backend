import { Injectable, Logger, BadRequestException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Request } from 'express';
import { ApiGatewayConfig } from '../config/api-gateway.config';

export interface VersionInfo {
  version: string;
  isDefault: boolean;
  isSupported: boolean;
  deprecationDate?: Date;
  sunset?: Date;
}

export interface VersionMeta {
  current: string;
  supported: string[];
  deprecated: string[];
  latest: string;
}

@Injectable()
export class VersioningService {
  private readonly logger = new Logger(VersioningService.name);
  private readonly config: ApiGatewayConfig;
  private readonly supportedVersions = new Set(['v1', 'v2']);
  private readonly deprecatedVersions = new Map<string, Date>();

  constructor(private readonly configService: ConfigService) {
    this.config = this.configService.get<ApiGatewayConfig>('apiGateway');
    this.initializeVersions();
  }

  /**
   * Initialize supported versions and deprecation dates
   */
  private initializeVersions(): void {
    // Mark older versions as deprecated
    this.deprecatedVersions.set('v1', new Date('2024-12-31')); // v1 deprecated end of 2024
    
    this.logger.log(`Initialized versioning with ${this.supportedVersions.size} supported versions`);
  }

  /**
   * Extract version from request using configured strategy
   */
  extractVersion(req: Request): VersionInfo {
    const { versioning } = this.config;
    let extractedVersion: string;

    switch (versioning.type) {
      case 'uri':
        extractedVersion = this.extractFromUri(req);
        break;
      case 'header':
        extractedVersion = this.extractFromHeader(req);
        break;
      case 'media-type':
        extractedVersion = this.extractFromMediaType(req);
        break;
      case 'custom':
        extractedVersion = this.extractFromCustom(req);
        break;
      default:
        extractedVersion = versioning.defaultVersion;
    }

    return this.getVersionInfo(extractedVersion);
  }

  /**
   * Extract version from URI path
   */
  private extractFromUri(req: Request): string {
    const pathMatch = req.path.match(/\/api\/v(\d+(?:\.\d+)?)/);
    if (pathMatch) {
      return `v${pathMatch[1]}`;
    }
    
    // Fallback to query parameter
    const queryVersion = req.query.version as string;
    if (queryVersion) {
      return queryVersion.startsWith('v') ? queryVersion : `v${queryVersion}`;
    }

    return this.config.versioning.defaultVersion;
  }

  /**
   * Extract version from header
   */
  private extractFromHeader(req: Request): string {
    const headerName = this.config.versioning.header?.toLowerCase() || 'x-api-version';
    const headerValue = req.headers[headerName] as string;
    
    if (headerValue) {
      return headerValue.startsWith('v') ? headerValue : `v${headerValue}`;
    }

    return this.config.versioning.defaultVersion;
  }

  /**
   * Extract version from Accept header media type
   */
  private extractFromMediaType(req: Request): string {
    const acceptHeader = req.headers.accept as string;
    if (!acceptHeader) {
      return this.config.versioning.defaultVersion;
    }

    // Look for version in media type: application/vnd.fundshield.v1+json
    const mediaTypeMatch = acceptHeader.match(/application\/vnd\.fundshield\.v(\d+(?:\.\d+)?)\+json/);
    if (mediaTypeMatch) {
      return `v${mediaTypeMatch[1]}`;
    }

    // Look for version parameter: application/json; version=1.0
    const versionParamMatch = acceptHeader.match(/version=(\d+(?:\.\d+)?)/);
    if (versionParamMatch) {
      return `v${versionParamMatch[1]}`;
    }

    return this.config.versioning.defaultVersion;
  }

  /**
   * Extract version using custom extractor
   */
  private extractFromCustom(req: Request): string {
    const { versioning } = this.config;
    
    if (versioning.extractor) {
      try {
        return versioning.extractor(req);
      } catch (error) {
        this.logger.warn(`Custom version extractor failed: ${error.message}`);
      }
    }

    return versioning.defaultVersion;
  }

  /**
   * Get detailed version information
   */
  getVersionInfo(version: string): VersionInfo {
    const normalizedVersion = this.normalizeVersion(version);
    
    return {
      version: normalizedVersion,
      isDefault: normalizedVersion === this.config.versioning.defaultVersion,
      isSupported: this.supportedVersions.has(normalizedVersion),
      deprecationDate: this.deprecatedVersions.get(normalizedVersion),
      sunset: this.getSunsetDate(normalizedVersion),
    };
  }

  /**
   * Normalize version string
   */
  private normalizeVersion(version: string): string {
    if (!version) {
      return this.config.versioning.defaultVersion;
    }

    // Remove 'v' prefix if present and add it back
    const cleanVersion = version.replace(/^v/, '');
    
    // Handle numeric versions
    if (/^\d+(\.\d+)?$/.test(cleanVersion)) {
      return `v${cleanVersion}`;
    }

    // Handle already formatted versions
    if (/^v\d+(\.\d+)?$/.test(version)) {
      return version;
    }

    this.logger.warn(`Invalid version format: ${version}, using default`);
    return this.config.versioning.defaultVersion;
  }

  /**
   * Get sunset date for a version
   */
  private getSunsetDate(version: string): Date | undefined {
    const deprecationDate = this.deprecatedVersions.get(version);
    if (!deprecationDate) {
      return undefined;
    }

    // Sunset 6 months after deprecation
    const sunsetDate = new Date(deprecationDate);
    sunsetDate.setMonth(sunsetDate.getMonth() + 6);
    return sunsetDate;
  }

  /**
   * Validate version and throw error if unsupported
   */
  validateVersion(version: string): void {
    const versionInfo = this.getVersionInfo(version);
    
    if (!versionInfo.isSupported) {
      throw new BadRequestException({
        error: 'Unsupported API Version',
        message: `API version '${version}' is not supported`,
        supportedVersions: Array.from(this.supportedVersions),
        requestedVersion: version,
      });
    }

    // Log warning for deprecated versions
    if (versionInfo.deprecationDate) {
      this.logger.warn(
        `Deprecated API version '${version}' used. ` +
        `Deprecation date: ${versionInfo.deprecationDate.toISOString()}. ` +
        `Sunset date: ${versionInfo.sunset?.toISOString() || 'TBD'}`
      );
    }
  }

  /**
   * Get version metadata
   */
  getVersionMeta(): VersionMeta {
    const supported = Array.from(this.supportedVersions);
    const deprecated = Array.from(this.deprecatedVersions.keys());
    
    return {
      current: this.config.versioning.defaultVersion,
      supported,
      deprecated,
      latest: supported[supported.length - 1] || this.config.versioning.defaultVersion,
    };
  }

  /**
   * Add supported version
   */
  addSupportedVersion(version: string): void {
    const normalizedVersion = this.normalizeVersion(version);
    this.supportedVersions.add(normalizedVersion);
    this.logger.log(`Added supported version: ${normalizedVersion}`);
  }

  /**
   * Mark version as deprecated
   */
  deprecateVersion(version: string, deprecationDate?: Date): void {
    const normalizedVersion = this.normalizeVersion(version);
    const date = deprecationDate || new Date();
    
    this.deprecatedVersions.set(normalizedVersion, date);
    this.logger.log(`Marked version ${normalizedVersion} as deprecated (${date.toISOString()})`);
  }

  /**
   * Remove version support
   */
  removeSupportedVersion(version: string): void {
    const normalizedVersion = this.normalizeVersion(version);
    this.supportedVersions.delete(normalizedVersion);
    this.deprecatedVersions.delete(normalizedVersion);
    this.logger.log(`Removed support for version: ${normalizedVersion}`);
  }

  /**
   * Check if version is deprecated
   */
  isVersionDeprecated(version: string): boolean {
    const normalizedVersion = this.normalizeVersion(version);
    return this.deprecatedVersions.has(normalizedVersion);
  }

  /**
   * Check if version is sunset (past sunset date)
   */
  isVersionSunset(version: string): boolean {
    const versionInfo = this.getVersionInfo(version);
    if (!versionInfo.sunset) {
      return false;
    }

    return new Date() > versionInfo.sunset;
  }

  /**
   * Get version routing path
   */
  getVersionPath(version: string, basePath: string): string {
    const versionInfo = this.getVersionInfo(version);
    
    if (this.config.versioning.type === 'uri') {
      return `/${versionInfo.version}${basePath}`;
    }

    return basePath;
  }

  /**
   * Transform request based on version
   */
  transformRequestForVersion(req: Request, version: string): any {
    const versionInfo = this.getVersionInfo(version);
    
    // Apply version-specific transformations
    switch (versionInfo.version) {
      case 'v1':
        return this.transformV1Request(req);
      case 'v2':
        return this.transformV2Request(req);
      default:
        return req.body;
    }
  }

  /**
   * Transform response based on version
   */
  transformResponseForVersion(data: any, version: string): any {
    const versionInfo = this.getVersionInfo(version);
    
    // Apply version-specific transformations
    switch (versionInfo.version) {
      case 'v1':
        return this.transformV1Response(data);
      case 'v2':
        return this.transformV2Response(data);
      default:
        return data;
    }
  }

  /**
   * V1 request transformation
   */
  private transformV1Request(req: Request): any {
    // V1 specific transformations
    const body = { ...req.body };
    
    // Convert newer field names to V1 format
    if (body.userId) {
      body.user_id = body.userId;
      delete body.userId;
    }
    
    return body;
  }

  /**
   * V2 request transformation
   */
  private transformV2Request(req: Request): any {
    // V2 specific transformations
    return req.body;
  }

  /**
   * V1 response transformation
   */
  private transformV1Response(data: any): any {
    if (!data) return data;
    
    // Convert camelCase to snake_case for V1 compatibility
    if (Array.isArray(data)) {
      return data.map(item => this.convertKeysToSnakeCase(item));
    }
    
    return this.convertKeysToSnakeCase(data);
  }

  /**
   * V2 response transformation
   */
  private transformV2Response(data: any): any {
    // V2 uses modern camelCase format
    return data;
  }

  /**
   * Convert object keys to snake_case
   */
  private convertKeysToSnakeCase(obj: any): any {
    if (obj === null || typeof obj !== 'object') {
      return obj;
    }

    if (Array.isArray(obj)) {
      return obj.map(item => this.convertKeysToSnakeCase(item));
    }

    const result = {};
    Object.keys(obj).forEach(key => {
      const snakeKey = key.replace(/[A-Z]/g, letter => `_${letter.toLowerCase()}`);
      result[snakeKey] = this.convertKeysToSnakeCase(obj[key]);
    });

    return result;
  }
}