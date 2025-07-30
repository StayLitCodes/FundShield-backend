import { Injectable, BadRequestException } from '@nestjs/common';
import { extname } from 'path';
import { v4 as uuidv4 } from 'uuid';
import { diskStorage } from 'multer';

export const uploadDir = './uploads';

@Injectable()
export class FileUploadService {
  getMulterOptions(folder: string) {
    return {
      storage: diskStorage({
        destination: `${uploadDir}/${folder}`,
        filename: (req, file, cb) => {
          const ext = extname(file.originalname);
          const filename = `${uuidv4()}${ext}`;
          cb(null, filename);
        },
      }),
      fileFilter: (req, file, cb) => {
        if (!file.mimetype.match(/^(image\/|application\/pdf)/)) {
          return cb(new BadRequestException('Only images and PDFs are allowed!'), false);
        }
        cb(null, true);
      },
      limits: {
        fileSize: 5 * 1024 * 1024, // 5MB
      },
    };
  }

  getFileUrl(folder: string, filename: string): string {
    return `/uploads/${folder}/${filename}`;
  }
} 