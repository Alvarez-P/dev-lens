import { FrameworkCandidate } from '@/modules/analysis/domain/framework-candidate.vo';

describe('FrameworkCandidate', () => {
  describe('create', () => {
    it('should create a candidate with framework, file and markers', () => {
      const candidate = FrameworkCandidate.create({
        framework: 'nestjs',
        file: 'package.json',
        markers: ['@nestjs/core'],
      });

      expect(candidate.framework).toBe('nestjs');
      expect(candidate.file).toBe('package.json');
      expect(candidate.markers).toEqual(['@nestjs/core']);
    });

    it('should normalize framework casing to lowercase', () => {
      const candidate = FrameworkCandidate.create({
        framework: 'NestJS',
        file: 'package.json',
        markers: ['@nestjs/core'],
      });

      expect(candidate.framework).toBe('nestjs');
    });
  });

  describe('validation', () => {
    it('should reject a blank framework name', () => {
      expect(() =>
        FrameworkCandidate.create({ framework: '   ', file: 'package.json', markers: ['x'] }),
      ).toThrow('Framework name must not be blank');
    });

    it('should reject a blank manifest file path', () => {
      expect(() =>
        FrameworkCandidate.create({ framework: 'nestjs', file: '', markers: ['x'] }),
      ).toThrow('Manifest file must not be blank');
    });

    it('should reject a candidate without markers', () => {
      expect(() =>
        FrameworkCandidate.create({ framework: 'nestjs', file: 'package.json', markers: [] }),
      ).toThrow('at least one marker');
    });
  });

  describe('immutability', () => {
    it('should defensively copy the markers array on creation', () => {
      const markers = ['@nestjs/core'];
      const candidate = FrameworkCandidate.create({
        framework: 'nestjs',
        file: 'package.json',
        markers,
      });
      markers.push('express');

      expect(candidate.markers).toEqual(['@nestjs/core']);
    });

    it('should be frozen so property assignment throws', () => {
      const candidate = FrameworkCandidate.create({
        framework: 'nestjs',
        file: 'package.json',
        markers: ['@nestjs/core'],
      });

      expect(() => {
        (candidate as unknown as { framework: string }).framework = 'express';
      }).toThrow();
    });
  });

  describe('toJSON', () => {
    it('should serialize to a plain object', () => {
      const candidate = FrameworkCandidate.create({
        framework: 'nestjs',
        file: 'package.json',
        markers: ['@nestjs/core'],
      });

      expect(candidate.toJSON()).toEqual({
        framework: 'nestjs',
        file: 'package.json',
        markers: ['@nestjs/core'],
      });
    });
  });
});
