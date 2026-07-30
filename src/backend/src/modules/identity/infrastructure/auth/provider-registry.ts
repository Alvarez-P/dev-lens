import { Injectable } from '@nestjs/common';
import { ExternalIdentityProvider } from '../../domain/external-identity-provider.interface';

@Injectable()
export class ProviderRegistry {
  private readonly providers = new Map<string, ExternalIdentityProvider>();

  register(provider: ExternalIdentityProvider): void {
    const name = provider.getProviderName();

    if (this.providers.has(name)) {
      throw new Error(`Provider "${name}" is already registered`);
    }

    this.providers.set(name, provider);
  }

  resolve(providerName: string): ExternalIdentityProvider {
    const provider = this.providers.get(providerName);

    if (!provider) {
      throw new Error(`Provider "${providerName}" not found`);
    }

    return provider;
  }

  getRegisteredProviders(): string[] {
    return Array.from(this.providers.keys());
  }
}
