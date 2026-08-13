import { DocFormat } from '@/modules/documentation/domain/doc-format.enum';
import {
  contentTypeForFormat,
  downloadFilename,
  fileExtForFormat,
} from '@/modules/documentation/infrastructure/controllers/doc-file-meta';

/**
 * Task 6.3 — pure helpers for the download endpoint (api R4, storage R6):
 * format → file extension (mirrors the renderer `ext` values) and content type
 * (mirrors the renderer `contentType` values), plus the `{docType}.{ext}`
 * download filename.
 */

describe('doc-file-meta (6.3) — download file metadata', () => {
  describe('fileExtForFormat', () => {
    it('should map markdown to .md', () => {
      expect(fileExtForFormat(DocFormat.MARKDOWN)).toBe('md');
    });

    it('should map html to .html', () => {
      expect(fileExtForFormat(DocFormat.HTML)).toBe('html');
    });

    it('should map openapi to the compound .openapi.json extension', () => {
      expect(fileExtForFormat(DocFormat.OPENAPI)).toBe('openapi.json');
    });

    it('should map every DocFormat to an extension', () => {
      for (const format of Object.values(DocFormat)) {
        expect(fileExtForFormat(format)).toEqual(expect.any(String));
      }
    });
  });

  describe('contentTypeForFormat', () => {
    it('should map markdown to text/markdown', () => {
      expect(contentTypeForFormat(DocFormat.MARKDOWN)).toBe('text/markdown');
    });

    it('should map html to text/html', () => {
      expect(contentTypeForFormat(DocFormat.HTML)).toBe('text/html');
    });

    it('should map openapi and json to application/json', () => {
      expect(contentTypeForFormat(DocFormat.OPENAPI)).toBe('application/json');
      expect(contentTypeForFormat(DocFormat.JSON)).toBe('application/json');
    });
  });

  describe('downloadFilename', () => {
    it('should build the attachment filename from docType and format ext', () => {
      expect(downloadFilename('readme', DocFormat.MARKDOWN)).toBe('readme.md');
      expect(downloadFilename('api-reference', DocFormat.OPENAPI)).toBe(
        'api-reference.openapi.json',
      );
    });
  });
});
