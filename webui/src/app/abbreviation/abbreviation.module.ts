import {NgModule} from '@angular/core';
import {MatProgressSpinnerModule} from '@angular/material/progress-spinner';
import {BrowserModule} from '@angular/platform-browser';

import {AbbreviationRefinementModule} from '../abbreviation-refinement/abbreviation-refinement.module';
import {PhraseModule} from '../phrase/phrase.module';

import {AbbreviationComponent} from './abbreviation.component';

@NgModule({
  declarations: [AbbreviationComponent],
  imports: [
    AbbreviationRefinementModule,
    BrowserModule,
    MatProgressSpinnerModule,
    PhraseModule,
  ],
  exports: [AbbreviationComponent],
})
export class AbbreviationModule {
}
