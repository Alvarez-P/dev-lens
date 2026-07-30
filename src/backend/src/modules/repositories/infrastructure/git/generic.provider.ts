import { Injectable } from '@nestjs/common';
import { GitProviderInterface } from './provider.interface';

@Injectable()
export class GenericProvider implements GitProviderInterface {
  async validateUrl(_url: string, _credential?: string): Promise<boolean> {
    return true;
  }

  async validateCredentials(_url: string, _credential: string): Promise<boolean> {
    return true;
  }

  async getDefaultBranch(_url: string, _credential?: string): Promise<string> {
    return 'main';
  }

  async getRepoInfo(
    url: string,
    _credential?: string,
  ): Promise<{ name: string; description?: string; visibility?: string; size?: number }> {
    const segments = url.replace(/\.git$/, '').split('/');
    return { name: segments[segments.length - 1] || 'unknown' };
  }
}
