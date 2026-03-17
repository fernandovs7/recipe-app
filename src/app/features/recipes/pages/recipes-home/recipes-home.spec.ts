import { ComponentFixture, TestBed } from '@angular/core/testing';

import { RecipesHome } from './recipes-home';

describe('RecipesHome', () => {
  let component: RecipesHome;
  let fixture: ComponentFixture<RecipesHome>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [RecipesHome]
    })
    .compileComponents();

    fixture = TestBed.createComponent(RecipesHome);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
