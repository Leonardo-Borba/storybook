// Should be added first :
//   Custom Elements polyfill. Required for browsers that do not natively support Custom Elements.
import '@webcomponents/custom-elements';
//   Custom Elements ES5 shim. Required when using ES5 bundles on browsers that natively support
//   Custom Elements (either because the browser does not support ES2015 modules or because the app
//   is explicitly configured to generate ES5 only bundles).
import '@webcomponents/custom-elements/src/native-shim';

import { Injector, NgModule, Type } from '@angular/core';
import { createCustomElement, NgElementConstructor } from '@angular/elements';

import { BehaviorSubject } from 'rxjs';
import { ICollection, StoryFnAngularReturnType } from '../types';
import { Parameters } from '../types-6-0';
import { getStorybookModuleMetadata } from './StorybookModule';
import { RendererService } from './RendererService';

const customElementsVersions: Record<string, number> = {};

/**
 * Bootstrap angular application to generate a web component with angular element
 */
export class ElementRendererService {
  private rendererService = RendererService.getInstance();

  /**
   * Returns a custom element generated by Angular elements
   */
  public async renderAngularElement({
    storyFnAngular,
    parameters,
    targetDOMNode,
  }: {
    storyFnAngular: StoryFnAngularReturnType;
    parameters: Parameters;
    targetDOMNode: HTMLElement;
  }): Promise<void> {
    const id = `${targetDOMNode.id}`;

    // Upgrade story version in order that the next defined component has a unique key
    customElementsVersions[id] =
      customElementsVersions[id] !== undefined ? customElementsVersions[id] + 1 : 0;

    const targetSelector = `${id}_${customElementsVersions[id]}`;

    const ngModule = getStorybookModuleMetadata(
      { storyFnAngular, parameters },
      new BehaviorSubject<ICollection>(storyFnAngular.props)
    );

    await this.rendererService.newPlatformBrowserDynamic();

    this.rendererService.initAngularRootElement(targetDOMNode);

    await this.rendererService.platform
      .bootstrapModule(createElementsModule(ngModule, targetSelector))
      .then(async (m) => {
        await this.rendererService.destroyPlatformBrowserDynamic();

        /** Hack :
         * After `destroyPlatformBrowserDynamic` we add the customElements previously created
         * Note: If it is added before the `destroyPlatformBrowserDynamic` it will be deleted with it :/
         * Not sure if this is the best way to do it.
         * /!\ Does not work with ivy
         */
        // eslint-disable-next-line no-param-reassign
        targetDOMNode.innerHTML = '';
        // eslint-disable-next-line no-undef
        targetDOMNode.appendChild(document.createElement(targetSelector));
      });
  }
}

const createElementsModule = (
  ngModule: NgModule,
  targetSelector: string
): Type<{ ngEl: CustomElementConstructor }> => {
  @NgModule({ ...ngModule, entryComponents: [] })
  class ElementsModule {
    public ngEl: NgElementConstructor<unknown>;

    constructor(private injector: Injector) {
      this.ngEl = createCustomElement(ngModule.bootstrap[0] as Type<unknown>, {
        injector: this.injector,
      });
      // eslint-disable-next-line no-undef
      customElements.define(targetSelector, this.ngEl);
    }

    ngDoBootstrap() {}
  }
  return ElementsModule;
};
