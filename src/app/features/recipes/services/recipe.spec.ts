import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';

import { AuthUser, AuthService } from '../../../core/services/auth.service';
import { RecipeService } from './recipe.service';

describe('RecipeService', () => {
  let service: RecipeService;
  const user = signal<AuthUser | null>(null);
  const authService = { user };

  beforeEach(() => {
    user.set(null);
    TestBed.configureTestingModule({
      providers: [{ provide: AuthService, useValue: authService }],
    });
    service = TestBed.inject(RecipeService);
  });

  it('should be created with an empty recipe list', () => {
    expect(service).toBeTruthy();
    expect(service.recipes()).toEqual([]);
    expect(service.loading()).toBe(false);
  });

  it('should reject recipe creation when there is no authenticated user', async () => {
    await expect(service.createRecipe({} as never)).rejects.toThrow('User not authenticated');
  });
});
