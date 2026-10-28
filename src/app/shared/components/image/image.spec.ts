import { ComponentFixture, TestBed } from '@angular/core/testing';

import { ImageComponent } from './image';

describe('ImageComponent', () => {
  let component: ImageComponent;
  let fixture: ComponentFixture<ImageComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [ImageComponent],
    }).compileComponents();

    fixture = TestBed.createComponent(ImageComponent);
    fixture.componentRef.setInput('image', {
      src: 'assets/images/test-image.jpg',
      alt: 'Imagen de prueba',
      width: 640,
      height: 480,
      fallback: 'assets/images/shared/image-fallback.png',
    });
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create and render the supplied image data', () => {
    const image = fixture.nativeElement.querySelector('img') as HTMLImageElement;

    expect(component).toBeTruthy();
    expect(image.getAttribute('src')).toContain('assets/images/test-image.jpg');
    expect(image.alt).toBe('Imagen de prueba');
    expect(image.width).toBe(640);
    expect(image.height).toBe(480);
  });

  it('should use the fallback after the primary image fails', async () => {
    component.onError();
    await fixture.whenStable();

    const image = fixture.nativeElement.querySelector('img') as HTMLImageElement;
    expect(image.getAttribute('src')).toContain('assets/images/shared/image-fallback.png');
  });
});
