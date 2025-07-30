import { Injectable, Logger, BadRequestException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Evidence } from '../entities/evidence.entity';
import { EvidenceStatus, EvidenceType } from '../enums/evidence.enum';
import { SubmitEvidenceDto, VerifyEvidenceDto } from '../dto/evidence.dto';
import { IpfsService } from './ipfs.service';
import * as crypto from 'crypto';

@Injectable()
export class EvidenceService {
  private readonly logger = new Logger(EvidenceService.name);

  constructor(
    @InjectRepository(Evidence)
    private evidenceRepository: Repository<Evidence>,
    private ipfsService: IpfsService,
  ) {}

  /**
   * Submit evidence for a dispute
   */
  async submitEvidence(dto: SubmitEvidenceDto, file?: Express.Multer.File): Promise<Evidence> {
    try {
      let ipfsHash: string;
      let checksum: string;
      let fileName: string;
      let mimeType: string;
      let fileSize: number;

      if (file) {
        // Upload file to IPFS
        ipfsHash = await this.ipfsService.uploadFile(file.buffer, file.originalname);
        checksum = crypto.createHash('sha256').update(file.buffer).digest('hex');
        fileName = file.originalname;
        mimeType = file.mimetype;
        fileSize = file.size;
      } else if (dto.content) {
        // Upload text content to IPFS
        const contentBuffer = Buffer.from(dto.content, 'utf8');
        ipfsHash = await this.ipfsService.uploadFile(contentBuffer, `evidence-${Date.now()}.txt`);
        checksum = crypto.createHash('sha256').update(contentBuffer).digest('hex');
        fileName = `evidence-${Date.now()}.txt`;
        mimeType = 'text/plain';
        fileSize = contentBuffer.length;
      } else {
        throw new BadRequestException('Either file or content must be provided');
      }

      const evidence = this.evidenceRepository.create({
        disputeId: dto.disputeId,
        submittedBy: dto.submittedBy,
        type: dto.type,
        title: dto.title,
        description: dto.description,
        ipfsHash,
        fileName,
        mimeType,
        fileSize,
        checksum,
        status: EvidenceStatus.PENDING_REVIEW,
        metadata: dto.metadata,
      });

      const savedEvidence = await this.evidenceRepository.save(evidence);

      this.logger.log(`Evidence submitted for dispute ${dto.disputeId}: ${savedEvidence.id}`);
      return savedEvidence;
    } catch (error) {
      this.logger.error(`Error submitting evidence: ${error.message}`);
      throw new BadRequestException('Failed to submit evidence');
    }
  }

  /**
   * Verify evidence integrity
   */
  async verifyEvidence(dto: VerifyEvidenceDto): Promise<Evidence> {
    const evidence = await this.evidenceRepository.findOne({
      where: { id: dto.evidenceId },
    });

    if (!evidence) {
      throw new BadRequestException('Evidence not found');
    }

    try {
      // Retrieve file from IPFS
      const fileBuffer = await this.ipfsService.getFile(evidence.ipfsHash);
      
      // Verify checksum
      const computedChecksum = crypto.createHash('sha256').update(fileBuffer).digest('hex');
      
      if (computedChecksum !== evidence.checksum) {
        evidence.status = EvidenceStatus.REJECTED;
        evidence.metadata = {
          ...evidence.metadata,
          verificationError: 'Checksum mismatch',
        };
      } else {
        evidence.status = EvidenceStatus.VERIFIED;
        evidence.isVerified = true;
        evidence.verifiedAt = new Date();
        evidence.verifiedBy = dto.verifiedBy;
      }

      const updatedEvidence = await this.evidenceRepository.save(evidence);

      this.logger.log(`Evidence ${dto.evidenceId} verification: ${evidence.status}`);
      return updatedEvidence;
    } catch (error) {
      this.logger.error(`Error verifying evidence: ${error.message}`);
      
      evidence.status = EvidenceStatus.REJECTED;
      evidence.metadata = {
        ...evidence.metadata,
        verificationError: error.message,
      };
      
      return this.evidenceRepository.save(evidence);
    }
  }

  /**
   * Get evidence for a dispute
   */
  async getDisputeEvidence(disputeId: string): Promise<Evidence[]> {
    return this.evidenceRepository.find({
      where: { disputeId },
      relations: ['submitter'],
      order: { createdAt: 'ASC' },
    });
  }

  /**
   * Get evidence file content
   */
  async getEvidenceContent(evidenceId: string): Promise<Buffer> {
    const evidence = await this.evidenceRepository.findOne({
      where: { id: evidenceId },
    });

    if (!evidence) {
      throw new BadRequestException('Evidence not found');
    }

    if (!evidence.isVerified) {
      throw new BadRequestException('Evidence not verified');
    }

    try {
      return await this.ipfsService.getFile(evidence.ipfsHash);
    } catch (error) {
      this.logger.error(`Error retrieving evidence content: ${error.message}`);
      throw new BadRequestException('Failed to retrieve evidence content');
    }
  }

  /**
   * Delete evidence (mark as deleted, don't actually remove from IPFS)
   */
  async deleteEvidence(evidenceId: string, deletedBy: string): Promise<void> {
    const evidence = await this.evidenceRepository.findOne({
      where: { id: evidenceId },
    });

    if (!evidence) {
      throw new BadRequestException('Evidence not found');
    }

    evidence.metadata = {
      ...evidence.metadata,
      deletedAt: new Date(),
      deletedBy,
    };

    await this.evidenceRepository.save(evidence);
    this.logger.log(`Evidence ${evidenceId} marked as deleted by ${deletedBy}`);
  }
}