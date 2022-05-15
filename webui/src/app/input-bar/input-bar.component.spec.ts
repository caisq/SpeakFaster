/** Unit tests for InputBarComponent. */
import {Injectable} from '@angular/core';
import {ComponentFixture, fakeAsync, TestBed, tick} from '@angular/core/testing';
import {By} from '@angular/platform-browser';
import {Observable, Subject} from 'rxjs';

import * as cefSharp from '../../utils/cefsharp';
import {HttpEventLogger} from '../event-logger/event-logger-impl';
import * as ExternalEvents from '../external/external-events.component';
import {ExternalEventsComponent, repeatVirtualKey, resetReconStates, VIRTUAL_KEY} from '../external/external-events.component';
import {InputBarChipComponent} from '../input-bar-chip/input-bar-chip.component';
import {InputBarChipModule} from '../input-bar-chip/input-bar-chip.module';
import {LoadLexiconRequest} from '../lexicon/lexicon.component';
import {FillMaskRequest, SpeakFasterService} from '../speakfaster-service';
import {StudyManager, StudyUserTurn} from '../study/study-manager';
import {TestListener} from '../test-utils/test-cefsharp-listener';
import {InputAbbreviationChangedEvent} from '../types/abbreviation';
import {AddContextualPhraseRequest, AddContextualPhraseResponse} from '../types/contextual_phrase';
import {TextEntryEndEvent} from '../types/text-entry';

import {InputBarComponent, InputBarControlEvent, State} from './input-bar.component';
import {InputBarModule} from './input-bar.module';

@Injectable()
class SpeakFasterServiceForTest {
  public addContextualPhrase(request: AddContextualPhraseRequest):
      Observable<AddContextualPhraseResponse> {
    throw new Error('Should call spy instead of this method.');
  }
}

// TODO(cais): Fix these tests. DO NOT SUBMIT.
fdescribe('InputBarComponent', () => {
  let testListener: TestListener;
  let textEntryEndSubject: Subject<TextEntryEndEvent>;
  let inputBarControlSubject: Subject<InputBarControlEvent>;
  let abbreviationExpansionTriggers: Subject<InputAbbreviationChangedEvent>;
  let loadPrefixedLexiconRequestSubject: Subject<LoadLexiconRequest>;
  let fillMaskTriggers: Subject<FillMaskRequest>;
  let studyUserTurnsSubject: Subject<StudyUserTurn>;
  let fixture: ComponentFixture<InputBarComponent>;
  let speakFasterServiceForTest: SpeakFasterServiceForTest;
  let textEntryEndEvents: TextEntryEndEvent[];
  let inputAbbreviationChangeEvents: InputAbbreviationChangedEvent[];
  let LoadLexiconRequests: LoadLexiconRequest[];
  let fillMaskRequests: FillMaskRequest[];

  beforeEach(async () => {
    resetReconStates();
    testListener = new TestListener();
    (window as any)[cefSharp.BOUND_LISTENER_NAME] = testListener;
    textEntryEndSubject = new Subject();
    inputBarControlSubject = new Subject();
    abbreviationExpansionTriggers = new Subject();
    loadPrefixedLexiconRequestSubject = new Subject();
    fillMaskTriggers = new Subject();
    studyUserTurnsSubject = new Subject();
    speakFasterServiceForTest = new SpeakFasterServiceForTest();
    textEntryEndEvents = [];
    textEntryEndSubject.subscribe(event => {
      textEntryEndEvents.push(event);
    })
    inputAbbreviationChangeEvents = [];
    abbreviationExpansionTriggers.subscribe(
        (event: InputAbbreviationChangedEvent) => {
          inputAbbreviationChangeEvents.push(event);
        });
    LoadLexiconRequests = [];
    loadPrefixedLexiconRequestSubject.subscribe(
        (request: LoadLexiconRequest) => {
          LoadLexiconRequests.push(request);
        });
    fillMaskRequests = [];
    fillMaskTriggers.subscribe(request => {
      fillMaskRequests.push(request);
    });

    const studyManager = new StudyManager(null, null);
    studyManager.studyUserTurns = studyUserTurnsSubject;
    await TestBed
        .configureTestingModule({
          imports: [InputBarModule, InputBarChipModule],
          declarations: [InputBarComponent, InputBarChipComponent],
          providers: [
            {provide: SpeakFasterService, useValue: speakFasterServiceForTest},
            {provide: HttpEventLogger, useValue: new HttpEventLogger(null)},
            {provide: StudyManager, useValue: studyManager},
          ],
        })
        .compileComponents();
    fixture = TestBed.createComponent(InputBarComponent);
    fixture.componentInstance.userId = 'testuser';
    fixture.componentInstance.contextStrings = ['How are you'];
    fixture.componentInstance.supportsAbbrevationExpansion = true;
    fixture.componentInstance.textEntryEndSubject = textEntryEndSubject;
    fixture.componentInstance.inputBarControlSubject = inputBarControlSubject;
    fixture.componentInstance.fillMaskTriggers = fillMaskTriggers;
    fixture.componentInstance.abbreviationExpansionTriggers =
        abbreviationExpansionTriggers;
    fixture.componentInstance.loadPrefixedLexiconRequestSubject =
        loadPrefixedLexiconRequestSubject;
    fixture.detectChanges();
  });

  afterEach(async () => {
    HttpEventLogger.setFullLogging(false);
    if (cefSharp.BOUND_LISTENER_NAME in (window as any)) {
      delete (window as any)[cefSharp.BOUND_LISTENER_NAME];
    }
  });

  it('initially, input box is empty; chips are empty', () => {
    const inputText = fixture.debugElement.query(By.css('.base-text-area'));
    expect(inputText.nativeElement.innerText).toEqual('');
    expect(fixture.debugElement.queryAll(By.css('app-input-bar-chip-component'))
               .length)
        .toEqual(0);
    expect(fixture.debugElement.query(By.css('.expand-button'))).toBeNull();
    expect(fixture.debugElement.query(By.css('.spell-button'))).toBeNull();
    expect(fixture.debugElement.query(By.css('.abort-button'))).toBeNull();
  });

  function enterKeysIntoComponent(text: string) {
    const inputText = fixture.debugElement.query(By.css('.base-text-area'));
    for (let i = 1; i <= text.length; ++i) {
      const substr = text.substring(0, i);
      const key = text[i - 1];
      const event = new KeyboardEvent('keypress', {key});
      inputText.nativeElement.value = substr;
      fixture.componentInstance.onInputTextAreaKeyUp(event);
      fixture.detectChanges();
    }
  }

  for (const text of ['b', 'ba', 'ba ', ' b']) {
    it(`entering keys cause text and buttons and chips to be displayed: ` +
           `text = ${text}`,
       () => {
         enterKeysIntoComponent(text);

         const inputText =
             fixture.debugElement.query(By.css('.base-text-area'));
         expect(inputText.nativeElement.value).toEqual(text);
         expect(fixture.componentInstance
                    .inputStringIsCompatibleWithAbbreviationExpansion)
             .toBeTrue();
         expect(fixture.debugElement.query(By.css('.expand-button')))
             .not.toBeNull();
         expect(fixture.debugElement.query(By.css('.spell-button')))
             .not.toBeNull();
         expect(fixture.debugElement.query(By.css('.abort-button')))
             .not.toBeNull();
       });
  }

  it('entering keys into input box logs keypresses', () => {
    const keypressLogSpy =
        spyOn(fixture.componentInstance.eventLogger, 'logKeypress');
    enterKeysIntoComponent('a');

    expect(keypressLogSpy).toHaveBeenCalledTimes(1);
  });

  for (const [originalText, newKey] of [
           ['abc', '\n'],
           [' abc', '\n'],
           [' abc ', '\n'],
           ['abc ', ' '],
           ['abc ', ' '],
  ] as Array<[string, string]>) {
    it(`Keys trigger abbreviation expansion: ${originalText}: ${newKey}`,
       () => {
         const inputText =
             fixture.debugElement.query(By.css('.base-text-area'));
         inputText.nativeElement.value = originalText;
         fixture.detectChanges();
         inputText.nativeElement.value = originalText + newKey;
         const event = new KeyboardEvent('keypress', {key: '\n'});
         fixture.componentInstance.onInputTextAreaKeyUp(event);
         fixture.detectChanges();

         expect(inputAbbreviationChangeEvents.length).toEqual(1);
         const [aeEvent] = inputAbbreviationChangeEvents;
         const {abbreviationSpec} = aeEvent;
         expect(abbreviationSpec.readableString).toEqual('abc');
         expect(abbreviationSpec.tokens.length).toEqual(1);
         expect(abbreviationSpec.tokens[0].isKeyword).toBeFalse();
         expect(abbreviationSpec.tokens[0].value).toEqual('abc');
         expect(abbreviationSpec.lineageId).not.toBeNull();
       });
  }

  for (const [originalText, triggerKey] of [
           [' i am vg', '\n'],
           [' i am. vg', '\n'],
  ] as Array<[string, string]>) {
    it('Keys trigger abbreviation multi-token abbreviation expansion:' +
           `original text=${originalText}, trigger=${triggerKey}`,
       () => {
         const inputText =
             fixture.debugElement.query(By.css('.base-text-area'));
         inputText.nativeElement.value = originalText;
         fixture.detectChanges();
         inputText.nativeElement.value = originalText + triggerKey;
         const event = new KeyboardEvent('keypress', {key: triggerKey});
         fixture.componentInstance.onInputTextAreaKeyUp(event);
         fixture.detectChanges();

         expect(inputAbbreviationChangeEvents.length).toEqual(1);
         const [aeEvent] = inputAbbreviationChangeEvents;
         const {abbreviationSpec} = aeEvent;
         expect(abbreviationSpec.readableString).toEqual('i am vg');
         expect(abbreviationSpec.tokens.length).toEqual(3);
         expect(abbreviationSpec.tokens[0].isKeyword).toBeTrue();
         expect(abbreviationSpec.tokens[0].value).toEqual('i');
         expect(abbreviationSpec.tokens[1].isKeyword).toBeTrue();
         expect(abbreviationSpec.tokens[1].value).toEqual('am');
         expect(abbreviationSpec.tokens[2].isKeyword).toBeFalse();
         expect(abbreviationSpec.tokens[2].value).toEqual('vg');
         expect(abbreviationSpec.lineageId).not.toBeNull();
       });
  }

  it('clicking abort button clears state: no head keywords', () => {
    enterKeysIntoComponent('ab');
    fixture.detectChanges();
    const abortButton = fixture.debugElement.query(By.css('.abort-button'));
    abortButton.nativeElement.click();
    fixture.detectChanges();

    const inputText = fixture.debugElement.query(By.css('.base-text-area'));
    expect(inputText.nativeElement.value).toEqual('');
    expect(fixture.debugElement.queryAll(By.css('app-input-bar-chip-component'))
               .length)
        .toEqual(0);
    expect(fixture.debugElement.query(By.css('.expand-button'))).toBeNull();
    expect(fixture.debugElement.query(By.css('.spell-button'))).toBeNull();
    expect(fixture.debugElement.query(By.css('.abort-button'))).toBeNull();
  });

  it('too-long input abbreviation disables AE buttons and shows notice', () => {
    const inputText = fixture.debugElement.query(By.css('.base-text-area'));
    inputText.nativeElement.value = 'abcdefghijklm';  // Length 12.
    const event = new KeyboardEvent('keypress', {key: 'o'});
    fixture.componentInstance.onInputTextAreaKeyUp(event);
    fixture.detectChanges();

    expect(fixture.componentInstance
               .inputStringIsCompatibleWithAbbreviationExpansion)
        .toBeFalse();
    expect(fixture.debugElement.query(By.css('.expand-button'))).toBeNull();
    expect(fixture.debugElement.query(By.css('.spell-button'))).toBeNull();
    expect(fixture.debugElement.query(By.css('.abort-button'))).not.toBeNull();
    expect(fixture.debugElement.query(By.css('.length-limit-exceeded')))
        .not.toBeNull();
  });

  it('long input abbreviation followed by trigger sequence does not trigger AE',
     () => {
       // Length 13, excluding the two space keys.
       const originalText = 'abcdefghijklmo';
       const newKey = '\n';
       const inputText = fixture.debugElement.query(By.css('.base-text-area'));
       inputText.nativeElement.value = originalText;
       fixture.detectChanges();
       inputText.nativeElement.value = originalText + newKey;
       const event = new KeyboardEvent('keypress', {key: newKey});
       fixture.componentInstance.onInputTextAreaKeyUp(event);
       fixture.detectChanges();

       expect(inputAbbreviationChangeEvents.length).toEqual(0);
     });

  it('too many head keywords disable expand and spell buttons', () => {
    const inputText = fixture.debugElement.query(By.css('.base-text-area'));
    inputText.nativeElement.value = 'a big and red and d';  // # of keywords: 5.
    const event = new KeyboardEvent('keypress', {key: 'd'});
    fixture.componentInstance.onInputTextAreaKeyUp(event);
    fixture.detectChanges();

    expect(fixture.componentInstance
               .inputStringIsCompatibleWithAbbreviationExpansion)
        .toBeFalse();
    expect(fixture.debugElement.query(By.css('.expand-button'))).toBeNull();
    expect(fixture.debugElement.query(By.css('.spell-button'))).toBeNull();
    expect(fixture.debugElement.query(By.css('.abort-button'))).not.toBeNull();
    expect(fixture.debugElement.query(By.css('.length-limit-exceeded')))
        .not.toBeNull();
  });

  it('clicking abort button clears state: no head keywords', () => {
    const inputText = fixture.debugElement.query(By.css('.base-text-area'));
    inputText.nativeElement.value = 'a big and red and d';  // # of keywords: 5.
    const event = new KeyboardEvent('keypress', {key: 'd'});
    fixture.componentInstance.onInputTextAreaKeyUp(event);
    fixture.detectChanges();
    const abortButton = fixture.debugElement.query(By.css('.abort-button'));
    abortButton.nativeElement.click();
    fixture.detectChanges();

    expect(inputText.nativeElement.value).toEqual('');
    expect(fixture.debugElement.queryAll(By.css('app-input-bar-chip-component'))
               .length)
        .toEqual(0);
    expect(fixture.debugElement.query(By.css('.expand-button'))).toBeNull();
    expect(fixture.debugElement.query(By.css('.spell-button'))).toBeNull();
    expect(fixture.debugElement.query(By.css('.abort-button'))).toBeNull();
    expect(fixture.debugElement.query(By.css('.length-limit-exceeded')))
        .toBeNull();
  });

  it('clicking spell button injects chips', () => {
    enterKeysIntoComponent('ace');
    const spellButton = fixture.debugElement.query(By.css('.spell-button'));
    spellButton.nativeElement.click();
    fixture.detectChanges();

    const chips =
        fixture.debugElement.queryAll(By.css('app-input-bar-chip-component'));
    expect(chips.length).toEqual(3);
    expect((chips[0].componentInstance as InputBarChipComponent).text)
        .toEqual('a');
    expect((chips[1].componentInstance as InputBarChipComponent).text)
        .toEqual('c');
    expect((chips[2].componentInstance as InputBarChipComponent).text)
        .toEqual('e');
    expect(fixture.componentInstance.state).toEqual(State.CHOOSING_LETTER_CHIP);
    expect(fixture.debugElement.query(By.css('.expand-button'))).toBeNull();
    expect(fixture.debugElement.query(By.css('.spell-button'))).toBeNull();
    expect(fixture.debugElement.query(By.css('.length-limit-exceeded')))
    expect(fixture.debugElement.query(By.css('.abort-button'))).not.toBeNull();
    expect(LoadLexiconRequests.length).toEqual(0);
  });

  it('clicking spell button injects space key to self app', () => {
    enterKeysIntoComponent('ace');
    const spellButton = fixture.debugElement.query(By.css('.spell-button'));
    spellButton.nativeElement.click();

    expect(testListener.numRequestSoftkeyboardResetCalls).toEqual(1);
  });

  for (const triggerKey of [VIRTUAL_KEY.SPACE, VIRTUAL_KEY.ENTER]) {
    for (const endPunctuation of ['.', '?', '!']) {
      it('spelling word then enter trigger key triggers AE: ' +
             `trigger key = ${triggerKey}; ` +
             `ending punctuation = ${endPunctuation}`,
         () => {
           enterKeysIntoComponent('abc');
           const spellButton =
               fixture.debugElement.query(By.css('.spell-button'));
           spellButton.nativeElement.click();
           fixture.detectChanges();
           // The ending punctuation should be ignored by keyword AE.
           fixture.componentInstance.state = State.FOCUSED_ON_LETTER_CHIP;
           fixture.componentInstance.onChipTextChanged({text: 'bit'}, 1);
           fixture.detectChanges();
           const expandButton =
               fixture.debugElement.query(By.css('.expand-button'));
           expandButton.nativeElement.click();
           fixture.detectChanges();

           expect(fixture.componentInstance
                      .inputStringIsCompatibleWithAbbreviationExpansion)
               .toBeTrue();
           expect(inputAbbreviationChangeEvents.length).toEqual(1);
           expect(inputAbbreviationChangeEvents[0].requestExpansion).toBeTrue();
           const {abbreviationSpec} = inputAbbreviationChangeEvents[0];
           expect(abbreviationSpec.tokens.length).toEqual(3);
           expect(abbreviationSpec.readableString).toEqual('a bit c');
           // TODO(cais): Make assertion about eraseSequence with spelling.
           const {tokens} = abbreviationSpec;
           expect(tokens[0]).toEqual({value: 'a', isKeyword: false});
           expect(tokens[1]).toEqual({value: 'bit', isKeyword: true});
           expect(tokens[2]).toEqual({value: 'c', isKeyword: false});
         });
    }
  }

  it('clicking abort after clicking spell resets state', () => {
    enterKeysIntoComponent('abc');
    const spellButton = fixture.debugElement.query(By.css('.spell-button'));
    spellButton.nativeElement.click();
    fixture.detectChanges();
    // The ending punctuation should be ignored by keyword AE.
    fixture.componentInstance.state = State.FOCUSED_ON_LETTER_CHIP;
    fixture.componentInstance.onChipTextChanged({text: 'bit'}, 1);
    const abortButton = fixture.debugElement.query(By.css('.abort-button'));
    abortButton.nativeElement.click();
    fixture.detectChanges();

    expect(fixture.componentInstance.state).toEqual(State.ENTERING_BASE_TEXT);
    const chips =
        fixture.debugElement.queryAll(By.css('app-input-bar-chip-component'));
    expect(chips.length).toEqual(0);
    expect(fixture.debugElement.query(By.css('.expand-button'))).not.toBeNull();
    expect(fixture.debugElement.query(By.css('.spell-button'))).not.toBeNull();

    const expandButton = fixture.debugElement.query(By.css('.expand-button'));
    expandButton.nativeElement.click();

    expect(inputAbbreviationChangeEvents.length).toEqual(1);
    expect(inputAbbreviationChangeEvents[0].requestExpansion).toBeTrue();
    const {abbreviationSpec} = inputAbbreviationChangeEvents[0];
    expect(abbreviationSpec.tokens.length).toEqual(1);
    expect(abbreviationSpec.tokens[0].value).toEqual('abc');
    expect(abbreviationSpec.tokens[0].isKeyword).toBeFalse();
    expect(abbreviationSpec.readableString).toEqual('abc');
  });

  it('chips are shown during refinement', () => {
    inputBarControlSubject.next({
      chips: [
        {
          text: 'i',
        },
        {
          text: 'feel',
        },
        {
          text: 'great',
        }
      ]
    });
    fixture.detectChanges();

    const chips =
        fixture.debugElement.queryAll(By.css('app-input-bar-chip-component'));
    expect(chips.length).toEqual(3);
    expect((chips[0].componentInstance as InputBarChipComponent).text)
        .toEqual('i');
    expect((chips[1].componentInstance as InputBarChipComponent).text)
        .toEqual('feel');
    expect((chips[2].componentInstance as InputBarChipComponent).text)
        .toEqual('great');
    expect(fillMaskRequests.length).toEqual(0);
  });

  it('clicking chip during refinement triggers fillMask and calls ' +
         'self-app key inject',
     () => {
       inputBarControlSubject.next({
         chips: [
           {
             text: 'i',
           },
           {
             text: 'feel',
           },
           {
             text: 'great',
           }
         ]
       });
       fixture.detectChanges();
       const chips =
           fixture.debugElement.queryAll(By.css('app-input-bar-chip-component'))
       chips[2].nativeElement.click();

       expect(fillMaskRequests.length).toEqual(1);
       expect(fillMaskRequests[0]).toEqual({
         speechContent: 'How are you',
         phraseWithMask: 'i feel _',
         maskInitial: 'g',
       });
       expect(testListener.numRequestSoftkeyboardResetCalls).toEqual(1);
     });

  it('types keys during refinement registers manual revision', () => {
    inputBarControlSubject.next({
      chips: [
        {
          text: 'i',
        },
        {
          text: 'feel',
        },
        {
          text: 'great',
        },
      ]
    });
    fixture.detectChanges();
    fixture.componentInstance.onChipClicked(1),
        fixture.componentInstance.onChipTextChanged({text: 'felt'}, 1);
    fixture.componentInstance.onSpeakAsIsButtonClicked(new MouseEvent('click'));

    expect(textEntryEndEvents.length).toEqual(1);
    expect(textEntryEndEvents[0].text).toEqual('i felt great');
    expect(textEntryEndEvents[0].repeatLastNonEmpty).toBeFalse();
    expect(textEntryEndEvents[0].inAppTextToSpeechAudioConfig)
        .not.toBeUndefined();
  });

  it('clicking speak button clears text & clicking again triggers repeat',
     () => {
       enterKeysIntoComponent('it');
       const speakButton = fixture.debugElement.query(By.css('.speak-button'))
                               .query(By.css('.speak-button'));
       speakButton.nativeElement.click();

       expect(textEntryEndEvents.length).toEqual(1);
       expect(textEntryEndEvents[0].text).toEqual('it');
       expect(textEntryEndEvents[0].repeatLastNonEmpty).toBeFalse();

       speakButton.nativeElement.click();
       expect(textEntryEndEvents.length).toEqual(2);
       expect(textEntryEndEvents[1].text).toEqual('');
       expect(textEntryEndEvents[1].repeatLastNonEmpty).toBeTrue();
     });

  it('spell button is shown during word refinement', () => {
    fixture.componentInstance.inputString = 'ifg';
    inputBarControlSubject.next({
      chips: [
        {
          text: 'i',
        },
        {
          text: 'feel',
        },
        {
          text: 'great',
        }
      ]
    });
    fixture.detectChanges();

    expect(fixture.componentInstance.state).toEqual(State.CHOOSING_WORD_CHIP);
    const spellButton = fixture.debugElement.query(By.css('.spell-button'));
    expect(spellButton).not.toBeNull();
  });

  it('spell button is shown when word chip is chosen', () => {
    fixture.componentInstance.inputString = 'ifg';
    inputBarControlSubject.next({
      chips: [
        {
          text: 'i',
        },
        {
          text: 'feel',
        },
        {
          text: 'great',
        }
      ]
    });
    fixture.detectChanges();
    const chips =
        fixture.debugElement.queryAll(By.css('app-input-bar-chip-component'))
    chips[1].nativeElement.click();

    expect(fixture.componentInstance.state).toEqual(State.FOCUSED_ON_WORD_CHIP);
    const spellButton = fixture.debugElement.query(By.css('.spell-button'));
    expect(spellButton).not.toBeNull();
  });

  //   it('typing after word chips are injected', () => {
  //     fixture.componentInstance.inputString = 'ifg';
  //     inputBarControlSubject.next({
  //       chips: [
  //         {
  //           text: 'i',
  //         },
  //         {
  //           text: 'feel',
  //         },
  //         {
  //           text: 'great',
  //         }
  //       ]
  //     });
  //     fixture.detectChanges();
  //     fixture.componentInstance.state = State.ENTERING_BASE_TEXT;
  //     const chips =
  //         fixture.debugElement.queryAll(By.css('app-input-bar-chip-component'))
  //     chips[1].nativeElement.click();

  //     expect(fixture.componentInstance.state).toEqual(State.ENTERING_BASE_TEXT);
  //     const spellButton =
  //     fixture.debugElement.query(By.css('.spell-button'));
  //     expect(spellButton).not.toBeNull();

  //     enterKeysIntoComponent(['s', 'o'], 'i feel great so', /* baseLength= */
  //     13); fixture.detectChanges();
  //     expect(fixture.componentInstance.inputString).toEqual('i feel great
  //     so');
  //   });

  //   it('clicking spell under word refinement enters spelling mode', () => {
  //     fixture.componentInstance.inputString = 'ifg';
  //     inputBarControlSubject.next({
  //       chips: [
  //         {
  //           text: 'i',
  //         },
  //         {
  //           text: 'feel',
  //         },
  //         {
  //           text: 'great',
  //         }
  //       ]
  //     });
  //     fixture.detectChanges();
  //     const wordChips =
  //         fixture.debugElement.queryAll(By.css('app-input-bar-chip-component'))
  //     wordChips[1].nativeElement.click();
  //     const spellButton =
  //     fixture.debugElement.query(By.css('.spell-button'));
  //     spellButton.nativeElement.click();
  //     fixture.detectChanges();

  //     expect(fixture.componentInstance.state).toEqual(State.CHOOSING_LETTER_CHIP);
  //     const letterChips =
  //         fixture.debugElement.queryAll(By.css('app-input-bar-chip-component'))
  //     expect(letterChips.length).toEqual(3);
  //     expect((letterChips[0].componentInstance as
  //     InputBarChipComponent).text)
  //         .toEqual('i');
  //     expect((letterChips[1].componentInstance as
  //     InputBarChipComponent).text)
  //         .toEqual('f');
  //     expect((letterChips[2].componentInstance as
  //     InputBarChipComponent).text)
  //         .toEqual('g');
  //   });

  //   it('clicking inject text button injects keypresses with added final
  //   period',
  //      () => {
  //        const keySequence =
  //            ['a', 'l', 'l', VIRTUAL_KEY.SPACE, 'g', 'o', 'o', 'd'];
  //        const reconstructedText = 'all good';
  //        enterKeysIntoComponent(keySequence, reconstructedText);
  //        const injectButton =
  //            fixture.debugElement.query(By.css('.inject-button'));
  //        injectButton.nativeElement.click();

  //        expect(textEntryEndEvents.length).toEqual(1);
  //        const event = textEntryEndEvents[0];
  //        expect(event.isFinal).toBeTrue();
  //        expect(event.text).toEqual('all good. ');
  //        expect(event.injectedKeys).toEqual([
  //          'a', 'l', 'l', VIRTUAL_KEY.SPACE, 'g', 'o', 'o', 'd',
  //          VIRTUAL_KEY.PERIOD, VIRTUAL_KEY.SPACE
  //        ]);
  //        expect(event.inAppTextToSpeechAudioConfig).toBeUndefined();
  //        expect(event.timestampMillis).toBeGreaterThan(0);
  //        const calls = testListener.injectedKeysCalls;
  //        expect(calls.length).toEqual(1);
  //        expect(calls[0]).toEqual([65, 76, 76, 32, 71, 79, 79, 68, 190, 32]);
  //        expect(testListener.injectedTextCalls).toEqual(['all good. ']);
  //      });

  //   it('clicking inject button removes trailing and leading whitespace.', ()
  //   => {
  //     const keySequence =
  //         [VIRTUAL_KEY.SPACE, 'g', 'o', 'o', 'd', VIRTUAL_KEY.SPACE];
  //     const reconstructedText = ' good ';
  //     enterKeysIntoComponent(keySequence, reconstructedText);
  //     const injectButton =
  //     fixture.debugElement.query(By.css('.inject-button'));
  //     injectButton.nativeElement.click();

  //     expect(textEntryEndEvents.length).toEqual(1);
  //     const event = textEntryEndEvents[0];
  //     expect(event.isFinal).toBeTrue();
  //     expect(event.text).toEqual('good. ');
  //     expect(event.injectedKeys).toEqual([
  //       'g', 'o', 'o', 'd', VIRTUAL_KEY.PERIOD, VIRTUAL_KEY.SPACE
  //     ]);
  //     expect(event.inAppTextToSpeechAudioConfig).toBeUndefined();
  //     expect(event.timestampMillis).toBeGreaterThan(0);
  //     const calls = testListener.injectedKeysCalls;
  //     expect(calls.length).toEqual(1);
  //     expect(calls[0]).toEqual([71, 79, 79, 68, 190, 32]);
  //     expect(testListener.injectedTextCalls).toEqual(['good. ']);
  //   });

  //   it('clicking inject button with previous non-empty works', () => {
  //     textEntryEndSubject.next({
  //       text: 'Previous phrase',
  //       isFinal: true,
  //       timestampMillis: Date.now(),
  //     });
  //     fixture.componentInstance.inputString = '';
  //     fixture.detectChanges();
  //     const injectButton =
  //     fixture.debugElement.query(By.css('.inject-button'));
  //     injectButton.nativeElement.click();

  //     expect(textEntryEndEvents.length).toEqual(2);
  //     const event = textEntryEndEvents[1];
  //     expect(event.isFinal).toBeTrue();
  //     expect(event.text).toEqual('Previous phrase. ');
  //   });

  //   it('clicking inject button without previous non-empty has no effect', ()
  //   => {
  //     fixture.componentInstance.inputString = '';
  //     fixture.detectChanges();
  //     const injectButton =
  //     fixture.debugElement.query(By.css('.inject-button'));
  //     injectButton.nativeElement.click();

  //     expect(textEntryEndEvents.length).toEqual(0);
  //   });

  //   it('clicking inject text button injects keypresses without added final
  //   period',
  //      () => {
  //        const keySequence = [
  //          'a', 'l', 'l', VIRTUAL_KEY.SPACE, 'g', 'o', 'o', 'd',
  //          VIRTUAL_KEY.PERIOD
  //        ];
  //        const reconstructedText = 'all good';
  //        enterKeysIntoComponent(keySequence, reconstructedText);
  //        const injectButton =
  //            fixture.debugElement.query(By.css('.inject-button'));
  //        injectButton.nativeElement.click();

  //        expect(textEntryEndEvents.length).toEqual(1);
  //        const event = textEntryEndEvents[0];
  //        expect(event.isFinal).toBeTrue();
  //        expect(event.text).toEqual('all good. ');
  //        expect(event.injectedKeys).toEqual([
  //          'a', 'l', 'l', VIRTUAL_KEY.SPACE, 'g', 'o', 'o', 'd',
  //          VIRTUAL_KEY.PERIOD, VIRTUAL_KEY.SPACE
  //        ]);
  //        expect(event.inAppTextToSpeechAudioConfig).toBeUndefined();
  //        expect(event.timestampMillis).toBeGreaterThan(0);
  //      });

  //   it('Text predicton word chip injection sets correct state', () => {
  //     inputBarControlSubject.next({
  //       chips: [
  //         {
  //           text: 'i am feeling',
  //           isTextPrediction: true,
  //         },
  //       ]
  //     });

  //     expect(fixture.componentInstance.state).toEqual(State.ENTERING_BASE_TEXT);
  //     expect(fixture.componentInstance.inputString).toEqual('i am feeling ');
  //   });

  //   it('type after multi-word text prediction chip and then spell', () => {
  //     inputBarControlSubject.next({
  //       chips: [
  //         {
  //           text: 'i am feeling',
  //           isTextPrediction: true,
  //         },
  //       ]
  //     });
  //     enterKeysIntoComponent(['s', 's', 'g'], 'i am feeling ssg', 13);
  //     const spellButton =
  //     fixture.debugElement.query(By.css('.spell-button'));
  //     spellButton.nativeElement.click();
  //     fixture.detectChanges();

  //     const chips =
  //         fixture.debugElement.queryAll(By.css('app-input-bar-chip-component'));
  //     expect(chips.length).toEqual(6);
  //     expect(chips[0].nativeElement.innerText).toEqual('i');
  //     expect(chips[1].nativeElement.innerText).toEqual('am');
  //     expect(chips[2].nativeElement.innerText).toEqual('feeling');
  //     expect(chips[3].nativeElement.innerText).toEqual('s');
  //     expect(chips[4].nativeElement.innerText).toEqual('s');
  //     expect(chips[5].nativeElement.innerText).toEqual('g');
  //     expect(fixture.componentInstance.state).toEqual(State.CHOOSING_LETTER_CHIP);
  //   });

  //   it('abort button is shown when text prediction chip is present',
  //      fakeAsync(() => {
  //        inputBarControlSubject.next({
  //          chips: [
  //            {
  //              text: 'i am feeling',
  //            },
  //          ]
  //        });
  //        (fixture.componentInstance as any).cutText = 'i am feeling';
  //        fixture.componentInstance.state = State.ENTERING_BASE_TEXT;
  //        fixture.detectChanges();

  //        const abortButton =
  //        fixture.debugElement.query(By.css('.abort-button'));
  //        expect(abortButton).not.toBeNull();

  //        const prevNumCalls = testListener.updateButtonBoxesCalls.length;
  //        abortButton.nativeElement.click();
  //        expect(fixture.componentInstance.state)
  //            .toEqual(State.ENTERING_BASE_TEXT);
  //        expect(fixture.componentInstance.chips.length).toEqual(0);
  //        expect(fixture.componentInstance.inputString).toEqual('');
  //        tick();
  //        expect(testListener.updateButtonBoxesCalls.length)
  //            .toEqual(prevNumCalls + 3);
  //        const lastCall =
  //            testListener
  //                .updateButtonBoxesCalls[testListener.updateButtonBoxesCalls.length
  //                - 1];
  //        expect(lastCall[0].indexOf('InputBarComponent_')).toEqual(0);
  //      }));

  //   it('launchin AE with pre-spelled words', () => {
  //     inputBarControlSubject.next({
  //       chips: [
  //         {
  //           text: 'i',
  //           preSpelled: true,
  //         },
  //         {
  //           text: 'am',
  //           preSpelled: true,
  //         },
  //         {
  //           text: 'feeling',
  //           preSpelled: true,
  //         },
  //         {
  //           text: 's',
  //         },
  //         {
  //           text: 'g',
  //         },
  //       ]
  //     });
  //     fixture.componentInstance.inputString = 'sg';
  //     fixture.componentInstance.state = State.CHOOSING_LETTER_CHIP;
  //     fixture.detectChanges();
  //     enterKeysIntoComponent(['g', 'o', 'o', 'd'], 'good');
  //     fixture.detectChanges();

  //     expect(fixture.componentInstance.state)
  //         .toEqual(State.FOCUSED_ON_LETTER_CHIP);
  //     expect(fixture.debugElement.query(By.css('.spell-button'))).toBeNull();
  //     const chips =
  //         fixture.debugElement.queryAll(By.css('app-input-bar-chip-component'));
  //     expect(chips.length).toEqual(5);
  //     expect(chips[0].nativeElement.innerText).toEqual('i');
  //     expect(chips[1].nativeElement.innerText).toEqual('am');
  //     expect(chips[2].nativeElement.innerText).toEqual('feeling');
  //     expect(chips[3].nativeElement.innerText).toEqual('s');
  //     expect(chips[4].nativeElement.innerText).toEqual('good |');
  //     expect(fixture.componentInstance
  //                .inputStringIsCompatibleWithAbbreviationExpansion)
  //         .toBeTrue();

  //     const expandButton =
  //     fixture.debugElement.query(By.css('.expand-button'));
  //     expandButton.nativeElement.click();
  //     fixture.detectChanges();

  //     expect(inputAbbreviationChangeEvents.length).toEqual(1);
  //     const event = inputAbbreviationChangeEvents[0];
  //     expect(event.requestExpansion).toBeTrue();
  //     const {abbreviationSpec} = event;
  //     expect(abbreviationSpec.readableString).toEqual('i am feeling s good');
  //     expect(abbreviationSpec.lineageId.length).toBeGreaterThan(0);
  //     expect(abbreviationSpec.tokens.length).toEqual(5);
  //     expect(abbreviationSpec.tokens[0]).toEqual({value: 'i', isKeyword:
  //     true}); expect(abbreviationSpec.tokens[1]).toEqual({value: 'am',
  //     isKeyword: true}); expect(abbreviationSpec.tokens[2])
  //         .toEqual({value: 'feeling', isKeyword: true});
  //     expect(abbreviationSpec.tokens[3]).toEqual({value: 's', isKeyword:
  //     false}); expect(abbreviationSpec.tokens[4])
  //         .toEqual({value: 'good', isKeyword: true});
  //   });

  //   it('Cut and then type after AE option selection', () => {
  //     inputBarControlSubject.next({
  //       chips: [
  //         {
  //           text: 'i',
  //         },
  //         {
  //           text: 'feel',
  //         },
  //         {
  //           text: 'great',
  //         }
  //       ]
  //     });
  //     fixture.componentInstance.state = State.CHOOSING_WORD_CHIP;
  //     fixture.detectChanges();
  //     const chips =
  //         fixture.debugElement.queryAll(By.css('app-input-bar-chip-component'));
  //     chips[1].nativeElement.click();
  //     fixture.detectChanges();

  //     const expandButton = fixture.debugElement.query(By.css('.cut-button'));
  //     expandButton.nativeElement.click();
  //     fixture.detectChanges();

  //     expect(fixture.componentInstance.state).toEqual(State.ENTERING_BASE_TEXT);
  //     expect(fixture.debugElement.queryAll(By.css('app-input-bar-chip-component'))
  //                .length)
  //         .toEqual(0);
  //     expect(fixture.componentInstance.inputString).toEqual('i feel ');

  //     enterKeysIntoComponent(['v', 'e'], 'i feel ve', /* baseLength= */ 7);
  //     expect(fixture.componentInstance.inputString).toEqual('i feel ve');
  //   });

  //   it('Selecting the last chip does not show cut button', () => {
  //     inputBarControlSubject.next({
  //       chips: [
  //         {
  //           text: 'i',
  //         },
  //         {
  //           text: 'feel',
  //         },
  //         {
  //           text: 'great',
  //         }
  //       ]
  //     });
  //     fixture.componentInstance.state = State.CHOOSING_WORD_CHIP;
  //     fixture.detectChanges();
  //     const chips =
  //         fixture.debugElement.queryAll(By.css('app-input-bar-chip-component'));
  //     chips[2].nativeElement.click();
  //     fixture.detectChanges();

  //     expect(fixture.debugElement.query(By.css('.cut-button'))).toBeNull();
  //   });

  //   it('typing then injecting text prediction combines text with prediction',
  //      () => {
  //        enterKeysIntoComponent(['w', 'o', 'w'], 'wow');
  //        inputBarControlSubject.next({
  //          chips: [{
  //            text: 'this is',
  //            isTextPrediction: true,
  //          }]
  //        });
  //        fixture.detectChanges();
  //        const chips = fixture.debugElement.queryAll(
  //            By.css('app-input-bar-chip-component'));

  //        expect(chips.length).toEqual(0);
  //        const text = fixture.debugElement.query(By.css('.base-text-area'));
  //        expect(text.nativeElement.innerText).toEqual('wow this is |');
  //        expect(fixture.componentInstance.state)
  //            .toEqual(State.ENTERING_BASE_TEXT);
  //        expect(fixture.debugElement.query(By.css('.spell-button'))).toBeNull();
  //      });

  //   it('multi-token abbreviation then hit spell: chips are correct', () => {
  //     enterKeysIntoComponent(
  //         [
  //           's', 'o', VIRTUAL_KEY.SPACE, 'm', 'u', 'c', 'h',
  //           VIRTUAL_KEY.SPACE, 'b', 'v'
  //         ],
  //         'so much bv');
  //     fixture.detectChanges();
  //     const spellButton =
  //     fixture.debugElement.query(By.css('.spell-button'));
  //     spellButton.nativeElement.click();
  //     fixture.detectChanges();

  //     const chips =
  //         fixture.debugElement.queryAll(By.css('app-input-bar-chip-component'));
  //     expect(chips.length).toEqual(4);
  //     expect(chips[0].nativeElement.innerText).toEqual('so');
  //     expect(chips[1].nativeElement.innerText).toEqual('much');
  //     expect(chips[2].nativeElement.innerText).toEqual('b');
  //     expect(chips[3].nativeElement.innerText).toEqual('v');
  //   });

  it('clicking favorite button calls ', () => {
    enterKeysIntoComponent('so long');
    const addContextualPhraseSpy =
        spyOn(speakFasterServiceForTest, 'addContextualPhrase');
    fixture.detectChanges();
    const favoriteButton =
        fixture.debugElement.query(By.css('app-favorite-button-component'))
            .query(By.css('.favorite-button'));
    favoriteButton.nativeElement.click();
    fixture.detectChanges();

    expect(addContextualPhraseSpy).toHaveBeenCalledOnceWith({
      userId: 'testuser',
      contextualPhrase: {
        phraseId: '',
        text: 'so long',
        tags: ['favorite'],
      },
    });
  });

  it('append text signal in input bar control subject works', () => {
    inputBarControlSubject.next({appendText: 'foo bar'});
    fixture.detectChanges();

    const inputText = fixture.debugElement.query(By.css('.base-text-area'));
    expect(inputText.nativeElement.value).toEqual('foo bar');
    expect(fixture.componentInstance.inputString).toEqual('foo bar');
    expect(fixture.componentInstance.state).toEqual(State.ENTERING_BASE_TEXT);
  });

  it('onFavoritePhraseAdded with success issues text-entry end event', () => {
    fixture.componentInstance.onFavoritePhraseAdded(
        {text: 'foo', success: true});

    expect(textEntryEndEvents.length).toEqual(1);
    expect(textEntryEndEvents[0].isFinal).toBeTrue();
    expect(textEntryEndEvents[0].text).toEqual('foo');
    expect(textEntryEndEvents[0].timestampMillis).toBeGreaterThan(0);
  });

  it('onFavoritePhraseAdded with failure issues text-entry end event', () => {
    fixture.componentInstance.onFavoritePhraseAdded(
        {text: 'foo', success: false});

    expect(textEntryEndEvents.length).toEqual(0);
  });

  it('study instrucitons and text are initially not shown', () => {
    expect(fixture.debugElement.query(By.css('.instruction'))).toBeNull();
    expect(fixture.debugElement.query(By.css('.to-enter-text'))).toBeNull();
  });

  it('study turn causes instruction and text to be shown', () => {
    studyUserTurnsSubject.next({
      text: 'All frequencies open',
      isAbbreviation: true,
      isComplete: false,
    });
    fixture.detectChanges();

    const instruction = fixture.debugElement.query(By.css('.instruction'));
    expect(instruction.nativeElement.innerText)
        .toEqual('Enter in abbreviation:');
    const toEnterText = fixture.debugElement.query(By.css('.to-enter-text'));
    expect(toEnterText.nativeElement.innerText).toEqual('All frequencies open');
  });

  it('null text in study turn subject resets UI state', () => {
    studyUserTurnsSubject.next({
      text: 'All frequencies open',
      isAbbreviation: true,
      isComplete: false,
    });
    studyUserTurnsSubject.next({
      text: null,
      isAbbreviation: true,
      isComplete: true,
    });
    fixture.detectChanges();

    expect(fixture.debugElement.query(By.css('.instruction'))).toBeNull();
    expect(fixture.debugElement.query(By.css('.to-enter-text'))).toBeNull();
  });

  it('completed state in study turn subject displays end state', () => {
    studyUserTurnsSubject.next({
      text: null,
      isAbbreviation: true,
      isComplete: true,
    });
    fixture.detectChanges();

    const dialogCompleteMessage =
        fixture.debugElement.query(By.css('.hint-dialog-complete'));
    expect(dialogCompleteMessage.nativeElement.innerText)
        .toEqual('Dialog is complete.');
    expect(fixture.debugElement.query(By.css('.dialog-error'))).toBeNull();
  });

  it('error state in study turn subject displays error message', () => {
    studyUserTurnsSubject.next({
      text: null,
      isAbbreviation: true,
      isComplete: true,
      error: 'Failed to load dialog "foo"',
    });
    fixture.detectChanges();

    const dialogCompleteMessage =
        fixture.debugElement.query(By.css('.hint-dialog-complete'));
    expect(dialogCompleteMessage.nativeElement.innerText)
        .toEqual('Failed to load dialog "foo"');
    expect(fixture.debugElement.query(By.css('.dialog-error'))
               .nativeElement.innerText)
        .toEqual('Failed to load dialog "foo"');
  });

  it('displays notification when set to non-empty', () => {
    fixture.componentInstance.notification = 'testing foo.';
    fixture.detectChanges();

    const notification = fixture.debugElement.query(By.css('.notification'));
    expect(notification.nativeElement.innerText).toEqual('testing foo.');
  });

  it('shows no notification if text is empty', () => {
    fixture.componentInstance.notification = '';
    fixture.detectChanges();

    expect(fixture.debugElement.query(By.css('.notification'))).toBeNull();
  });

  it('shows no notification by default', () => {
    expect(fixture.debugElement.query(By.css('.notification'))).toBeNull();
  });

  it('clears all state on clearAll command in control subject', () => {
    enterKeysIntoComponent('abc');
    inputBarControlSubject.next({
      clearAll: true,
    });

    expect(fixture.componentInstance.inputString).toEqual('');
  });

  //   it('append text twice calls updateButtonBoxes', async () => {
  //     await fixture.whenStable();
  //     const prevNumCalls = testListener.updateButtonBoxesCalls.length;
  //     inputBarControlSubject.next({appendText: 'foo bar'});
  //     fixture.detectChanges();
  //     await fixture.whenStable()
  //     inputBarControlSubject.next({appendText: 'foo bar'});
  //     fixture.detectChanges();
  //     await fixture.whenStable();

  //     expect(testListener.updateButtonBoxesCalls.length)
  //         .toEqual(prevNumCalls + 2);
  //   });

  //   // TODO(cais): Test spelling valid word triggers AE, with debounce.
});
