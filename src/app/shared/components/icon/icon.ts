import { CommonModule } from '@angular/common';
import { Component, computed, inject, input } from '@angular/core';
import { DomSanitizer, SafeHtml } from '@angular/platform-browser';
import {
  ArrowLeft,
  ArrowRight,
  BookOpen,
  Camera,
  Check,
  ChefHat,
  ChevronDown,
  Clock3,
  Flame,
  GripVertical,
  Heart,
  House,
  ImagePlus,
  LogIn,
  LogOut,
  Menu,
  Monitor,
  Moon,
  Pencil,
  Plus,
  RotateCcw,
  Search,
  SearchX,
  Share2,
  Sparkles,
  SquarePen,
  Sun,
  Timer,
  Trash2,
  TriangleAlert,
  Users,
  X,
} from 'lucide';

type LucideIconNode = [tag: string, attrs: Record<string, string | number | undefined>][];

const ICONS: Record<string, LucideIconNode> = {
  ArrowLeft,
  ArrowRight,
  BookOpen,
  Camera,
  Check,
  ChefHat,
  ChevronDown,
  Clock3,
  Flame,
  GripVertical,
  Heart,
  House,
  ImagePlus,
  LogIn,
  LogOut,
  Menu,
  Monitor,
  Moon,
  Pencil,
  Plus,
  RotateCcw,
  Search,
  SearchX,
  Share2,
  Sparkles,
  SquarePen,
  Sun,
  Timer,
  Trash2,
  TriangleAlert,
  Users,
  X,
};

@Component({
  selector: 'app-icon',
  imports: [CommonModule],
  templateUrl: './icon.html',
  styleUrl: './icon.scss',
})
export class IconComponent {
  private readonly sanitizer = inject(DomSanitizer);

  // Icon name accepts common formats like "chef-hat", "chefHat", or "ChefHat".
  name = input.required<string>();

  // Visual controls keep the component flexible across buttons, inputs, and headings.
  size = input<number>(20);
  strokeWidth = input<number>(2);
  absoluteStrokeWidth = input<boolean>(false);
  decorative = input<boolean>(true);
  title = input<string>('');

  private readonly iconDefinition = computed<LucideIconNode | null>(() => {
    const normalizedName = this.normalizeName(this.name());
    const candidate = ICONS[normalizedName];

    if (!Array.isArray(candidate)) {
      return null;
    }

    return candidate as LucideIconNode;
  });

  svg = computed<SafeHtml>(() => {
    const iconNode = this.iconDefinition();

    if (!iconNode) {
      return this.sanitizer.bypassSecurityTrustHtml('');
    }

    const size = this.size();
    const strokeWidth = this.absoluteStrokeWidth()
      ? (this.strokeWidth() * 24) / size
      : this.strokeWidth();
    const title = this.title().trim();
    const iconName = this.kebabCase(this.name());
    const ariaHidden = this.decorative() && !title ? 'true' : 'false';
    const ariaLabel = !this.decorative() && title ? ` aria-label="${this.escapeAttribute(title)}"` : '';
    const titleMarkup = title ? `<title>${this.escapeText(title)}</title>` : '';
    const nodesMarkup = iconNode
      .map(([tag, attrs]) => {
        const attrsMarkup = Object.entries(attrs)
          .filter(([, value]) => value !== undefined)
          .map(([key, value]) => `${key}="${this.escapeAttribute(String(value))}"`)
          .join(' ');

        return `<${tag} ${attrsMarkup}></${tag}>`;
      })
      .join('');

    const svgMarkup = `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="${strokeWidth}" stroke-linecap="round" stroke-linejoin="round" class="lucide lucide-${iconName}" style="display:block" aria-hidden="${ariaHidden}" role="img"${ariaLabel}>${titleMarkup}${nodesMarkup}</svg>`;

    return this.sanitizer.bypassSecurityTrustHtml(svgMarkup);
  });

  private normalizeName(name: string): string {
    return name
      .trim()
      .replace(/([a-z0-9])([A-Z])/g, '$1 $2')
      .split(/[\s_-]+/)
      .filter(Boolean)
      .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
      .join('');
  }

  private kebabCase(name: string): string {
    return name
      .trim()
      .replace(/([a-z0-9])([A-Z])/g, '$1-$2')
      .replace(/[\s_]+/g, '-')
      .toLowerCase();
  }

  private escapeAttribute(value: string): string {
    return value.replace(/&/g, '&amp;').replace(/"/g, '&quot;');
  }

  private escapeText(value: string): string {
    return value.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  }
}
