import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  InternalServerErrorException,
  Post,
  Query,
  Res,
  UploadedFile,
  UseInterceptors,
} from "@nestjs/common";
import { FileInterceptor } from "@nestjs/platform-express";
import type { Response } from "express";
import { basename } from "path";
import { S3Service } from "./s3.service";

@Controller("s3")
export class S3Controller {
  constructor(private readonly s3: S3Service) {}

  @Get("buckets")
  async listBuckets() {
    const data = await this.s3.listBuckets();
    return { ok: true, buckets: data.Buckets || [] };
  }

  @Get("objects")
  async listObjects(
    @Query("prefix") prefix?: string,
    @Query("continuationToken") continuationToken?: string,
    @Query("maxKeys") maxKeys?: string
  ) {
    const parsedMaxKeys = Number(maxKeys);
    const safeMaxKeys = Number.isFinite(parsedMaxKeys) ? Math.min(Math.max(parsedMaxKeys, 1), 1000) : 50;
    const data = await this.s3.listObjects(prefix, continuationToken, safeMaxKeys);
    return {
      ok: true,
      bucket: this.s3.bucketName,
      objects: data.Contents || [],
      isTruncated: Boolean(data.IsTruncated),
      nextToken: data.NextContinuationToken || null,
    };
  }

  @Post("upload")
  @UseInterceptors(FileInterceptor("file", { limits: { fileSize: 20 * 1024 * 1024 } }))
  async uploadFile(@UploadedFile() file: Express.Multer.File, @Body("key") key?: string) {
    if (!file) {
      throw new BadRequestException("Missing file");
    }
    const objectKey = key || file.originalname;
    if (!objectKey) {
      throw new BadRequestException("Missing object key");
    }

    await this.s3.upload(objectKey, file.buffer, file.mimetype);
    return { ok: true, bucket: this.s3.bucketName, key: objectKey };
  }

  @Delete("object")
  async deleteFile(@Query("key") key: string) {
    if (!key) {
      throw new BadRequestException("Missing object key");
    }
    await this.s3.delete(key);
    return { ok: true, bucket: this.s3.bucketName, key };
  }

  @Get("download")
  async downloadFile(@Query("key") key: string, @Query("download") download: string, @Res() res: Response) {
    if (!key) {
      throw new BadRequestException("Missing object key");
    }

    const data = await this.s3.download(key);
    const body = data.Body;
    if (!body || typeof (body as any).pipe !== "function") {
      throw new InternalServerErrorException("Invalid S3 response body");
    }

    if (data.ContentType) {
      res.setHeader("Content-Type", data.ContentType);
    }

    if (data.ContentLength) {
      res.setHeader("Content-Length", data.ContentLength.toString());
    }

    if (download === "1") {
      res.setHeader("Content-Disposition", `attachment; filename="${basename(key)}"`);
    }

    (body as any).pipe(res);
  }
}
