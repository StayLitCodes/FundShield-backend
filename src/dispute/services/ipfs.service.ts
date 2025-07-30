import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { create, IPFSHTTPClient } from 'ipfs-http-client';

@Injectable()
export class IpfsService {
  private readonly logger = new Logger(IpfsService.name);
  private ipfs: IPFSHTTPClient;

  constructor(private configService: ConfigService) {
    const ipfsUrl = this.configService.get<string>('IPFS_URL', 'http://localhost:5001');
    this.ipfs = create({ url: ipfsUrl });
  }

  /**
   * Upload file to IPFS
   */
  async uploadFile(buffer: Buffer, filename: string): Promise<string> {
    try {
      const result = await this.ipfs.add({
        content: buffer,
        path: filename,
      });

      this.logger.log(`File uploaded to IPFS: ${result.cid.toString()}`);
      return result.cid.toString();
    } catch (error) {
      this.logger.error(`Error uploading to IPFS: ${error.message}`);
      throw new Error('Failed to upload file to IPFS');
    }
  }

  /**
   * Get file from IPFS
   */
  async getFile(hash: string): Promise<Buffer> {
    try {
      const chunks = [];
      
      for await (const chunk of this.ipfs.cat(hash)) {
        chunks.push(chunk);
      }

      const buffer = Buffer.concat(chunks);
      this.logger.log(`File retrieved from IPFS: ${hash}`);
      return buffer;
    } catch (error) {
      this.logger.error(`Error retrieving from IPFS: ${error.message}`);
      throw new Error('Failed to retrieve file from IPFS');
    }
  }

  /**
   * Pin file to ensure persistence
   */
  async pinFile(hash: string): Promise<void> {
    try {
      await this.ipfs.pin.add(hash);
      this.logger.log(`File pinned in IPFS: ${hash}`);
    } catch (error) {
      this.logger.error(`Error pinning file in IPFS: ${error.message}`);
      throw new Error('Failed to pin file in IPFS');
    }
  }

  /**
   * Unpin file
   */
  async unpinFile(hash: string): Promise<void> {
    try {
      await this.ipfs.pin.rm(hash);
      this.logger.log(`File unpinned from IPFS: ${hash}`);
    } catch (error) {
      this.logger.error(`Error unpinning file from IPFS: ${error.message}`);
      // Don't throw error for unpinning failures
    }
  }

  /**
   * Check if IPFS node is online
   */
  async isOnline(): Promise<boolean> {
    try {
      await this.ipfs.id();
      return true;
    } catch (error) {
      this.logger.error(`IPFS node is offline: ${error.message}`);
      return false;
    }
  }
}