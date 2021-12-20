import {AfterViewInit, ChangeDetectorRef, Component, ElementRef, EventEmitter, Input, OnChanges, OnInit, Output, QueryList, ViewChildren} from '@angular/core';
import {Subject} from 'rxjs';
import {limitStringLength} from 'src/utils/text-utils';
import {createUuid} from 'src/utils/uuid';

import {updateButtonBoxesForElements} from '../../utils/cefsharp';
import {isPlainAlphanumericKey, isTextContentKey} from '../../utils/keyboard-utils';
import {KeyboardComponent} from '../keyboard/keyboard.component';
import {SpeakFasterService} from '../speakfaster-service';
import {AbbreviationSpec, InputAbbreviationChangedEvent} from '../types/abbreviation';
import {TextEntryEndEvent} from '../types/text-entry';

enum State {
  CHOOSING_EXPANSION = 'CHOOSING_EXPANSION',
  CHOOSING_EDIT_TARGET = 'CHOOSING_EDIT_TARGET',
  CHOOSING_TOKEN = 'CHOOSING_TOKEN',
  CHOOSING_TOKEN_REPLACEMENT = 'CHOOSING_TOKEN_REPLACEMENT',
}

@Component({
  selector: 'app-abbreviation-component',
  templateUrl: './abbreviation.component.html',
  providers: [SpeakFasterService],
})
export class AbbreviationComponent implements OnInit, AfterViewInit {
  private static readonly _NAME = 'AbbreviationComponent';
  private static readonly _POST_SELECTION_DELAY_MILLIS = 500;
  private static readonly _TOKEN_REPLACEMENT_KEYBOARD_CALLBACK_NAME =
      'AbbreviationComponent_TokenReplacementKeyboardCallbackName';
  private static readonly _MAX_NUM_REPLACEMENT_TOKENS = 6;
  private readonly instanceId =
      AbbreviationComponent._NAME + '_' + createUuid();
  @Input() contextStrings!: string[];
  @Input() textEntryEndSubject!: Subject<TextEntryEndEvent>;
  @Input()
  abbreviationExpansionTriggers!: Subject<InputAbbreviationChangedEvent>;
  @Input() abbreviationExpansionEditingTrigger!: Subject<boolean>;
  @Input() isSpelling: boolean = false;

  @ViewChildren('clickableButton')
  clickableButtons!: QueryList<ElementRef<HTMLElement>>;

  @ViewChildren('abbreviationOption')
  abbreviationOptionElements!: QueryList<ElementRef<HTMLElement>>;

  state = State.CHOOSING_EXPANSION;
  readonly editTokens: string[] = [];
  readonly replacementTokens: string[] = [];
  selectedTokenIndex: number|null = null;
  manualTokenString: string = '';

  abbreviation: AbbreviationSpec|null = null;
  requestOngoing: boolean = false;
  responseError: string|null = null;
  abbreviationOptions: string[] = [];
  private _selectedAbbreviationIndex: number = -1;

  constructor(
      public speakFasterService: SpeakFasterService,
      private cdr: ChangeDetectorRef) {}

  ngOnInit() {
    KeyboardComponent.registerCallback(
        AbbreviationComponent._NAME, this.baseKeyboardHandler.bind(this));
    this.abbreviationExpansionTriggers.subscribe(
        (event: InputAbbreviationChangedEvent) => {
          this.abbreviation = event.abbreviationSpec;
          if (event.requestExpansion) {
            this.expandAbbreviation();
          }
        });
  }

  ngAfterViewInit() {
    this.clickableButtons.changes.subscribe(
        (queryList: QueryList<ElementRef>) => {
          updateButtonBoxesForElements(
              AbbreviationComponent._NAME + this.instanceId, queryList);
        });
  }

  baseKeyboardHandler(event: KeyboardEvent): boolean {
    if (event.altKey || event.metaKey) {
      return false;
    }
    const keyIndex = event.keyCode - 49;
    // Ctrl E or Enter activates AE.
    // Ctrl Q clears all the expansion options (if any).
    if ((event.ctrlKey && event.key.toLocaleLowerCase() === 'e') ||
        (isPlainAlphanumericKey(event, 'Enter', false))) {
      this.expandAbbreviation();
      return true;
    } else if (event.ctrlKey && event.key.toLocaleLowerCase() === 'q') {
      this.abbreviationOptions.splice(0);
      return true;
    } else if (
        event.shiftKey && keyIndex >= 0 &&
        keyIndex < this.abbreviationOptions.length) {
      this.selectExpansionOption(keyIndex);
      return true;
    }
    return false;
  }

  get selectedAbbreviationIndex() {
    return this._selectedAbbreviationIndex;
  }

  onEditButtonClicked(event: Event) {
    this.state = State.CHOOSING_EDIT_TARGET;
  }

  onExpansionOptionButtonClicked(event: Event, index: number) {
    if (this.state === 'CHOOSING_EXPANSION') {
      this.selectExpansionOption(index);
    } else if (this.state === 'CHOOSING_EDIT_TARGET') {
      this.editTokens.splice(0);
      this.editTokens.push(...this.abbreviationOptions[index].split(' '));
      this.selectedTokenIndex = null;
      this.state = State.CHOOSING_TOKEN;
    }
  }

  onSpeakOptionButtonClicked(event: Event, index: number) {
    // TODO(cais): Implement.
  }

  onEditTokenButtonClicked(event: Event, index: number) {
    if (this.state !== State.CHOOSING_TOKEN) {
      return;
    }
    const tokensIncludingMask: string[] = this.editTokens.slice();
    tokensIncludingMask[index] = '_';
    const phraseWithMask = tokensIncludingMask.join(' ');
    const maskInitial = this.editTokens[index][0];
    const speechContent = this.contextStrings[this.contextStrings.length - 1];
    this.selectedTokenIndex = index;
    this.speakFasterService.fillMask(speechContent, phraseWithMask, maskInitial)
        .subscribe(
            data => {
              this.replacementTokens.splice(0);
              const replacements = data.results.slice();
              const originalToken = this.editTokens[this.selectedTokenIndex!];
              if (replacements.indexOf(originalToken) !== -1) {
                replacements.splice(replacements.indexOf(originalToken), 1);
              }
              this.replacementTokens.push(...replacements);
              if (this.replacementTokens.length >
                  AbbreviationComponent._MAX_NUM_REPLACEMENT_TOKENS) {
                this.replacementTokens.splice(
                    AbbreviationComponent._MAX_NUM_REPLACEMENT_TOKENS);
              }
              this.state = State.CHOOSING_TOKEN_REPLACEMENT;
              KeyboardComponent.registerCallback(
                  AbbreviationComponent
                      ._TOKEN_REPLACEMENT_KEYBOARD_CALLBACK_NAME,
                  this.handleKeyboardEventForReplacemenToken.bind(this));
            },
            error => {
                // TODO(cais): Handle fill mask error.
                // TODO(cais): Provide exit.
            });
  }

  private handleKeyboardEventForReplacemenToken(event: KeyboardEvent): boolean {
    if (isPlainAlphanumericKey(event, 'Enter')) {
      if (this.manualTokenString.trim().length > 0) {
        this.emitExpansionWithTokenReplacement(this.manualTokenString.trim());
        return true;
      } else if (this.selectedTokenIndex !== null) {
        // Use the original.
        this.emitExpansionWithTokenReplacement(
            this.editTokens[this.selectedTokenIndex]);
        return true;
      }
    } else if (isTextContentKey(event)) {
      this.manualTokenString += event.key.toLocaleLowerCase();
      return true;
    } else if (isPlainAlphanumericKey(event, 'Backspace')) {
      if (this.manualTokenString.length > 0) {
        this.manualTokenString =
            this.manualTokenString.slice(0, this.manualTokenString.length - 1);
        return true;
      }
    }
    return false;
  }

  onReplacementTokenButtonClicked(event: Event, index: number) {
    // Reconstruct the phrase with the replacement.
    this.emitExpansionWithTokenReplacement(this.replacementTokens[index]);
  }

  private emitExpansionWithTokenReplacement(replacementToken: string) {
    // Reconstruct the phrase with the replacement.
    const tokens: string[] = this.editTokens.slice();
    tokens[this.selectedTokenIndex!] = replacementToken;
    this.textEntryEndSubject.next({
      text: tokens.join(' '),
      timestampMillis: Date.now(),
      isFinal: true,
    });
    KeyboardComponent.unregisterCallback(
        AbbreviationComponent._TOKEN_REPLACEMENT_KEYBOARD_CALLBACK_NAME);
    // TODO(cais): Prevent selection in gap state.
    setTimeout(() => this.resetState(), 1000);
  }

  private selectExpansionOption(index: number) {
    if (this._selectedAbbreviationIndex === index) {
      return;
    }
    this._selectedAbbreviationIndex = index;
    this.textEntryEndSubject.next({
      text: this.abbreviationOptions[this._selectedAbbreviationIndex],
      timestampMillis: Date.now(),
      isFinal: true,
    });
    // TODO(cais): Prevent selection in gap state.
    setTimeout(
        () => this.resetState(),
        AbbreviationComponent._POST_SELECTION_DELAY_MILLIS);
  }

  private resetState() {
    this.abbreviation = null;
    this.requestOngoing = false;
    this.responseError = null;
    if (this.abbreviationOptions.length > 0) {
      this.abbreviationOptions.splice(0);
    }
    this._selectedAbbreviationIndex = -1;
    this.editTokens.splice(0);
    this.replacementTokens.splice(0);
    this.manualTokenString = '';
    this.state = State.CHOOSING_EXPANSION;
    this.cdr.detectChanges();
  }

  private expandAbbreviation() {
    if (this.contextStrings.length === 0) {
      this.responseError =
          'Cannot expand abbreviation: no speech content as context';
      return;
    }
    if (this.abbreviation === null) {
      this.responseError = 'Cannot expand abbreviation: empty abbreviation';
      return;
    }
    this.abbreviationOptions = [];
    this.requestOngoing = true;
    this.responseError = null;
    const LIMIT_TURNS = 2;
    const LIMIT_CONTECT_TURN_LENGTH = 60
    const usedContextStrings = [...this.contextStrings.map(
        contextString =>
            limitStringLength(contextString, LIMIT_CONTECT_TURN_LENGTH))];
    if (usedContextStrings.length > LIMIT_TURNS) {
      usedContextStrings.splice(0, usedContextStrings.length - LIMIT_TURNS);
    }
    // TODO(cais): Limit by token length?
    const numSamples = this.getNumSamples(this.abbreviation);
    console.log(
        `Calling expandAbbreviation() (numSamples=${numSamples}):`,
        usedContextStrings, this.abbreviation);
    this.speakFasterService
        .expandAbbreviation(
            usedContextStrings.join('|'), this.abbreviation, numSamples)
        .subscribe(
            data => {
              this.requestOngoing = false;
              if (data.exactMatches != null) {
                this.abbreviationOptions = data.exactMatches;
                this.cdr.detectChanges();
              }
            },
            error => {
              this.requestOngoing = false;
              this.responseError = error.message;
              this.cdr.detectChanges();
            });
  }

  /** Heuristics about the num_samples to use when requesting AE from server. */
  private getNumSamples(abbreviationSpec: AbbreviationSpec|null) {
    if (abbreviationSpec === null) {
      return 128;
    }
    let maxAbbrevLength = 0;
    for (const token of abbreviationSpec.tokens) {
      if (!token.isKeyword && token.value.length > maxAbbrevLength) {
        maxAbbrevLength = token.value.length;
      }
    }
    return maxAbbrevLength > 5 ? 256 : 128;
  }
}
