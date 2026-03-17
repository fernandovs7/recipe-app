import { ComponentFixture, TestBed } from '@angular/core/testing';

import { AuthenticatedLayout } from './authenticated-layout';

describe('AuthenticatedLayout', () => {
  let component: AuthenticatedLayout;
  let fixture: ComponentFixture<AuthenticatedLayout>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [AuthenticatedLayout]
    })
    .compileComponents();

    fixture = TestBed.createComponent(AuthenticatedLayout);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
