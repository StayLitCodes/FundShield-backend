// import {
//   Injectable,
//   PipeTransform,
//   ArgumentMetadata,
//   BadRequestException,
//   Logger,
// } from '@nestjs/common';
// import { VersioningService } from '../services/versioning.service';

// @Injectable()
// export class ApiVersionPipe implements PipeTransform {
//   private readonly logger = new Logger(ApiVersionPipe.name);

//   constructor(private readonly versioningService: VersioningService) {}

//   transform(value: any, metadata: ArgumentMetadata): any {
//     // Only transform if this is a version parameter
//     if (metadata.type === 'param' && metadata.data === 'version') {
//       return this.transformVersionParam(value);
//     }

//     // For other parameters, just validate if they contain version info
//     if (metadata.type === 'body' && value && typeof value === 'object') {
//       return this.validateVersionInBody(value);
//     }

//     return value;
//   }

//   /**
//    * Transform version parameter
//    */
//   private transformVersionParam(version: string): string {
//     if (!version) {
//       throw new BadRequestException({
//         error: 'Missing Version Parameter',
//         message: 'API version parameter is required',
//       });
//     }

//     const versionInfo = this.versioningService.getVersionInfo(version);
    
//     if (!versionInfo.isSupported) {
//       throw new BadRequestException({
//         error: 'Unsupported Version',
//         message: `API version '${version}' is not supported`,
//         supportedVersions: this.versioningService.getVersionMeta().supported,
//       });
//     }

//     this.logger.debug(`Transformed version parameter: ${version} -> ${versionInfo.version}`);
//     return versionInfo.version;
//   }

//   /**
//    * Validate version information in request body
//    */
//   private validateVersionInBody(body: any): any {
//     if (body.apiVersion || body.version) {
//       const version = body.apiVersion || body.version;
//       const versionInfo = this.versioningService.getVersionInfo(version);
      
//       if (!versionInfo.isSupported) {
//         throw new BadRequestException({
//           error: 'Unsupported Version in Body',
//           message: `API version '${version}' specified in request body is not supported`,
//           supportedVersions: this.versioningService.getVersionMeta().supported,
//         });
//       }

//       // Normalize version in body
//       body.apiVersion = versionInfo.version;
//       if (body.version) {
//         body.version = versionInfo.version;
//       }
//     }

//     return body;
//   }
// }