import {
  Injectable,
  CanActivate,
  ExecutionContext,
  BadRequestException,
  Logger,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { Request } from 'express';
import { VersioningService } from '../services/versioning.service';
import {
  API_VERSION_KEY,
  VERSION_NEUTRAL_KEY,
  DEPRECATED_VERSION_KEY,
} from '../decorators/versioning.decorators';

@Injectable()
export class ApiVersionGuard implements CanActivate {
  private readonly logger = new Logger(ApiVersionGuard.name);

  constructor(
    private readonly reflector: Reflector,
    private readonly versioningService: VersioningService,
  ) {}

  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest<Request>();

    // Check if endpoint is version-neutral
    const isVersionNeutral = this.reflector.getAllAndOverride<boolean>(
      VERSION_NEUTRAL_KEY,
      [context.getHandler(), context.getClass()],
    );

    if (isVersionNeutral) {
      this.logger.debug(`Version-neutral endpoint accessed: ${request.path}`);
      return true;
    }

    // Extract version from request
    const versionInfo = this.versioningService.extractVersion(request);

    // Validate version format and support
    this.versioningService.validateVersion(versionInfo.version);

    // Get required versions for this endpoint
    const requiredVersions = this.reflector.getAllAndOverride<string[]>(
      API_VERSION_KEY,
      [context.getHandler(), context.getClass()],
    );

    if (requiredVersions && requiredVersions.length > 0) {
      if (!requiredVersions.includes(versionInfo.version)) {
        throw new BadRequestException({
          error: 'Version Mismatch',
          message: `This endpoint requires API version: ${requiredVersions.join(' or ')}`,
          requestedVersion: versionInfo.version,
          supportedVersions: requiredVersions,
        });
      }
    }

    // Check for deprecated version warnings
    const deprecatedInfo = this.reflector.getAllAndOverride<{
      version: string;
      deprecationDate?: Date;
      sunsetDate?: Date;
    }>(DEPRECATED_VERSION_KEY, [context.getHandler(), context.getClass()]);

    if (deprecatedInfo && deprecatedInfo.version === versionInfo.version) {
      this.logger.warn(
        `Deprecated version ${versionInfo.version} accessed for ${request.path}. ` +
          `Deprecation date: ${deprecatedInfo.deprecationDate}. ` +
          `Sunset date: ${deprecatedInfo.sunsetDate}`,
      );

      // Add deprecation headers
      const response = context.switchToHttp().getResponse();
      response.setHeader('X-API-Deprecated', 'true');
      response.setHeader(
        'X-API-Deprecation-Date',
        deprecatedInfo.deprecationDate,
      );
      if (deprecatedInfo.sunsetDate) {
        response.setHeader('X-API-Sunset-Date', deprecatedInfo.sunsetDate);
      }
    }

    // Add version info to request for downstream use
    request['apiVersion'] = versionInfo.version;
    request['versionInfo'] = versionInfo;

    this.logger.debug(
      `API version ${versionInfo.version} validated for ${request.path}`,
    );
    return true;
  }
}
