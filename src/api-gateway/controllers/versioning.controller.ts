import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  Query,
  UseGuards,
  Logger,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiParam,
  ApiQuery,
  ApiBearerAuth,
} from '@nestjs/swagger';
import { VersioningService, VersionMeta } from '../services/versioning.service';
import { ApiVersion, VersionNeutral } from '../decorators/versioning.decorators';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../../auth/guards/roles.guard';
import { Roles } from '../../auth/decorators/roles.decorator';

class VersionInfoDto {
  version: string;
  isDefault: boolean;
  isSupported: boolean;
  deprecationDate?: Date;
  sunset?: Date;
}

class AddVersionDto {
  version: string;
  isDefault?: boolean;
}

class DeprecateVersionDto {
  version: string;
  deprecationDate?: Date;
}

@ApiTags('API Versioning')
@Controller('api/versioning')
@VersionNeutral()
export class VersioningController {
  private readonly logger = new Logger(VersioningController.name);

  constructor(private readonly versioningService: VersioningService) {}

  @Get('info')
  @ApiOperation({
    summary: 'Get API versioning information',
    description: 'Returns comprehensive information about API versioning including supported versions, deprecated versions, and metadata.',
  })
  @ApiResponse({
    status: 200,
    description: 'Version information retrieved successfully',
    schema: {
      properties: {
        current: { type: 'string', example: 'v1' },
        supported: { type: 'array', items: { type: 'string' }, example: ['v1', 'v2'] },
        deprecated: { type: 'array', items: { type: 'string' }, example: ['v0'] },
        latest: { type: 'string', example: 'v2' },
      },
    },
  })
  getVersionInfo(): VersionMeta {
    const versionMeta = this.versioningService.getVersionMeta();
    this.logger.log('Version information requested');
    return versionMeta;
  }

  @Get('check/:version')
  @ApiOperation({
    summary: 'Check specific version information',
    description: 'Get detailed information about a specific API version including support status and deprecation details.',
  })
  @ApiParam({
    name: 'version',
    description: 'API version to check (e.g., v1, v2)',
    example: 'v1',
  })
  @ApiResponse({
    status: 200,
    description: 'Version check completed successfully',
    type: VersionInfoDto,
  })
  @ApiResponse({
    status: 400,
    description: 'Invalid version format',
  })
  checkVersion(@Param('version') version: string): VersionInfoDto {
    const versionInfo = this.versioningService.getVersionInfo(version);
    this.logger.log(`Version check requested for: ${version}`);
    return versionInfo;
  }

  @Get('validate')
  @ApiOperation({
    summary: 'Validate version from request headers',
    description: 'Validate the API version specified in request headers or query parameters.',
  })
  @ApiQuery({
    name: 'version',
    description: 'Version to validate (optional, will extract from headers if not provided)',
    required: false,
    example: 'v1',
  })
  @ApiResponse({
    status: 200,
    description: 'Version validation successful',
    schema: {
      properties: {
        valid: { type: 'boolean' },
        version: { type: 'string' },
        source: { type: 'string', enum: ['header', 'query', 'uri', 'default'] },
        warnings: { type: 'array', items: { type: 'string' } },
      },
    },
  })
  validateVersion(@Query('version') queryVersion?: string) {
    // This would normally extract from request, but for demo purposes
    // we'll use the query parameter
    const version = queryVersion || 'v1';
    
    try {
      this.versioningService.validateVersion(version);
      const versionInfo = this.versioningService.getVersionInfo(version);
      
      const warnings = [];
      if (versionInfo.deprecationDate) {
        warnings.push(`Version ${version} is deprecated and will sunset on ${versionInfo.sunset?.toISOString()}`);
      }
      
      return {
        valid: true,
        version: versionInfo.version,
        source: queryVersion ? 'query' : 'default',
        warnings,
      };
    } catch (error) {
      return {
        valid: false,
        version,
        source: queryVersion ? 'query' : 'default',
        error: error.message,
      };
    }
  }

  @Post('add')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('admin')
  @ApiBearerAuth()
  @ApiOperation({
    summary: 'Add new API version (Admin only)',
    description: 'Add support for a new API version. Requires admin privileges.',
  })
  @ApiResponse({
    status: 201,
    description: 'Version added successfully',
    schema: {
      properties: {
        message: { type: 'string' },
        version: { type: 'string' },
        supported: { type: 'array', items: { type: 'string' } },
      },
    },
  })
  @ApiResponse({
    status: 403,
    description: 'Forbidden - Admin access required',
  })
  addVersion(@Body() addVersionDto: AddVersionDto) {
    this.versioningService.addSupportedVersion(addVersionDto.version);
    
    const response = {
      message: `Version ${addVersionDto.version} added successfully`,
      version: addVersionDto.version,
      supported: this.versioningService.getVersionMeta().supported,
    };
    
    this.logger.log(`Admin added new API version: ${addVersionDto.version}`);
    return response;
  }

  @Post('deprecate')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('admin')
  @ApiBearerAuth()
  @ApiOperation({
    summary: 'Deprecate API version (Admin only)',
    description: 'Mark an API version as deprecated with optional deprecation date. Requires admin privileges.',
  })
  @ApiResponse({
    status: 200,
    description: 'Version deprecated successfully',
    schema: {
      properties: {
        message: { type: 'string' },
        version: { type: 'string' },
        deprecationDate: { type: 'string', format: 'date-time' },
        sunsetDate: { type: 'string', format: 'date-time' },
      },
    },
  })
  @ApiResponse({
    status: 403,
    description: 'Forbidden - Admin access required',
  })
  deprecateVersion(@Body() deprecateVersionDto: DeprecateVersionDto) {
    const deprecationDate = deprecateVersionDto.deprecationDate || new Date();
    this.versioningService.deprecateVersion(deprecateVersionDto.version, deprecationDate);
    
    const versionInfo = this.versioningService.getVersionInfo(deprecateVersionDto.version);
    
    const response = {
      message: `Version ${deprecateVersionDto.version} deprecated successfully`,
      version: deprecateVersionDto.version,
      deprecationDate: deprecationDate.toISOString(),
      sunsetDate: versionInfo.sunset?.toISOString(),
    };
    
    this.logger.log(`Admin deprecated API version: ${deprecateVersionDto.version}`);
    return response;
  }

  @Get('migration-guide/:fromVersion/:toVersion')
  @ApiOperation({
    summary: 'Get migration guide between versions',
    description: 'Get guidance on migrating from one API version to another.',
  })
  @ApiParam({
    name: 'fromVersion',
    description: 'Source version',
    example: 'v1',
  })
  @ApiParam({
    name: 'toVersion',
    description: 'Target version',
    example: 'v2',
  })
  @ApiResponse({
    status: 200,
    description: 'Migration guide retrieved successfully',
    schema: {
      properties: {
        fromVersion: { type: 'string' },
        toVersion: { type: 'string' },
        changes: { type: 'array', items: { type: 'object' } },
        breakingChanges: { type: 'array', items: { type: 'object' } },
        migrationSteps: { type: 'array', items: { type: 'string' } },
      },
    },
  })
  getMigrationGuide(
    @Param('fromVersion') fromVersion: string,
    @Param('toVersion') toVersion: string,
  ) {
    // This would normally contain actual migration data
    // For now, returning a template
    return {
      fromVersion,
      toVersion,
      changes: [
        {
          type: 'field_renamed',
          from: 'user_id',
          to: 'userId',
          endpoints: ['/users', '/profiles'],
        },
        {
          type: 'new_field',
          field: 'metadata',
          description: 'Additional metadata object added to responses',
          endpoints: ['*'],
        },
      ],
      breakingChanges: [
        {
          type: 'response_format',
          description: 'Error responses now include additional context fields',
          impact: 'Error handling code may need updates',
        },
      ],
      migrationSteps: [
        'Update error handling to use new error response format',
        'Replace snake_case field names with camelCase',
        'Test all endpoints with new version header',
        'Update client libraries to support new response structure',
      ],
    };
  }
}