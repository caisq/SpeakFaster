/** Unit tests for InputBarComponent. */
import {ElementRef, Injectable, QueryList} from '@angular/core';
import {ComponentFixture, TestBed} from '@angular/core/testing';
import {By} from '@angular/platform-browser';
import {Subject} from 'rxjs';

import {repeatVirtualKey, VIRTUAL_KEY} from '../external/external-events.component';
import {InputBarChipComponent} from '../input-bar-chip/input-bar-chip.component';
import {LoadLexiconRequest} from '../lexicon/lexicon.component';
import {FillMaskRequest, SpeakFasterService} from '../speakfaster-service';
import {InputAbbreviationChangedEvent} from '../types/abbreviation';
import {TextEntryEndEvent} from '../types/text-entry';

import {InputBarComponent, InputBarControlEvent} from './input-bar.component';
import {InputBarModule} from './input-bar.module';

@Injectable()
class SpeakFasterServiceForTest {
}

fdescribe('InputBarComponent', () => {
  let textEntryEndSubject: Subject<TextEntryEndEvent>;
  let inputBarControlSubject: Subject<InputBarControlEvent>;
  let abbreviationExpansionTriggers: Subject<InputAbbreviationChangedEvent>;
  let loadPrefixedLexiconRequestSubject: Subject<LoadLexiconRequest>;
  let fillMaskTriggers: Subject<FillMaskRequest>;
  let fixture: ComponentFixture<InputBarComponent>;
  let speakFasterServiceForTest: SpeakFasterServiceForTest;
  let textEntryEndEvents: TextEntryEndEvent[];
  let inputAbbreviationChangeEvents: InputAbbreviationChangedEvent[];
  let LoadLexiconRequests: LoadLexiconRequest[];
  let fillMaskRequests: FillMaskRequest[];

  beforeEach(async () => {
    textEntryEndSubject = new Subject();
    inputBarControlSubject = new Subject();
    abbreviationExpansionTriggers = new Subject();
    loadPrefixedLexiconRequestSubject = new Subject();
    fillMaskTriggers = new Subject();
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

    await TestBed
        .configureTestingModule({
          imports: [InputBarModule],
          declarations: [InputBarComponent],
          providers: [
            {provide: SpeakFasterService, useValue: speakFasterServiceForTest}
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

  it('input box is initially empty', () => {
    const inputText = fixture.debugElement.query(By.css('.input-text'));
    expect(inputText.nativeElement.innerText).toEqual('');
    expect(fixture.debugElement.queryAll(By.css('app-input-bar-chip-component'))
               .length)
        .toEqual(0);
    expect(fixture.debugElement.query(By.css('.expand-button'))).toBeNull();
    expect(fixture.debugElement.query(By.css('.spell-button'))).toBeNull();
    expect(fixture.debugElement.query(By.css('.abort-button'))).toBeNull();
  });

  it('initially displays cursor', () => {
    expect(fixture.debugElement.query(By.css('.simulated-cursor')))
        .not.toBeNull();
  });

  function enterKeysIntoComponent(
      keySequence: Array<string|VIRTUAL_KEY>, reconstructedText: string,
      baseLength = 0): void {
    for (let i = 0; i < keySequence.length; ++i) {
      const currentKeySequence = keySequence.slice(0, i + 1)
      fixture.componentInstance.listenToKeypress(
          currentKeySequence, reconstructedText.slice(0, baseLength + i + 1));
      fixture.detectChanges();
    }
  }

  for (const [keySequence, reconstructedText, expectedText] of [
           [['b'], 'b', 'b'],
           [['b', 'a'], 'ba', 'ba'],
           [['b', 'a', VIRTUAL_KEY.BACKSPACE], 'b', 'b'],
           [['b', 'a', VIRTUAL_KEY.BACKSPACE, 'c'], 'bc', 'bc'],
           [['b', VIRTUAL_KEY.SPACE], 'b ', 'b '],
           [[VIRTUAL_KEY.SPACE, 'b'], ' b', 'b'],
           [[VIRTUAL_KEY.ENTER, 'b'], ' b', 'b'],
           [[VIRTUAL_KEY.SPACE, VIRTUAL_KEY.ENTER, 'b'], ' b', 'b'],
  ] as Array<[string[], string, string]>) {
    it(`entering keys cause text and buttons to be displayed: ` +
           `key sequence = ${JSON.stringify(keySequence)}`,
       () => {
         enterKeysIntoComponent(keySequence, reconstructedText);

         const inputText = fixture.debugElement.query(By.css('.input-text'));
         expect(inputText.nativeElement.innerText).toEqual(expectedText);
         expect(fixture.debugElement.query(By.css('.expand-button')))
             .not.toBeNull();
         expect(fixture.debugElement.query(By.css('.spell-button')))
             .not.toBeNull();
         expect(fixture.debugElement.query(By.css('.abort-button')))
             .not.toBeNull();
         expect(fixture.debugElement.query(By.css('.simulated-cursor')))
             .not.toBeNull();
       });
  }

  it('clicking abort button clears state: no head keywords', () => {
    fixture.componentInstance.listenToKeypress(['a', 'b'], 'ab');
    fixture.detectChanges();
    const abortButton = fixture.debugElement.query(By.css('.abort-button'));
    abortButton.nativeElement.click();
    fixture.detectChanges();

    const inputText = fixture.debugElement.query(By.css('.input-text'));
    expect(inputText.nativeElement.innerText).toEqual('');
    expect(fixture.debugElement.queryAll(By.css('app-input-bar-chip-component'))
               .length)
        .toEqual(0);
    expect(fixture.debugElement.query(By.css('.expand-button'))).toBeNull();
    expect(fixture.debugElement.query(By.css('.spell-button'))).toBeNull();
    expect(fixture.debugElement.query(By.css('.abort-button'))).toBeNull();
  });

  for (const
           [keySequence, reconstructedText, expectedAbbreviationString,
            expectdEraserSequenceLength] of
               [[
                 ['x', 'y', VIRTUAL_KEY.SPACE, VIRTUAL_KEY.SPACE], 'xy  ', 'xy',
                 4
               ],
                [['x', 'y', VIRTUAL_KEY.ENTER], 'xy\n', 'xy', 3],
                [
                  ['x', 'y', VIRTUAL_KEY.SPACE, VIRTUAL_KEY.ENTER], 'xy \n',
                  'xy', 4
                ],
  ] as Array<[string[], string, string, number]>) {
    it(`key sequence triggers AE: ` +
           `key sequence: ${JSON.stringify(keySequence)}`,
       () => {
         enterKeysIntoComponent(keySequence, reconstructedText);

         expect(inputAbbreviationChangeEvents.length).toEqual(1);
         const {abbreviationSpec} = inputAbbreviationChangeEvents[0];
         expect(abbreviationSpec.readableString)
             .toEqual(expectedAbbreviationString);
         expect(abbreviationSpec.tokens.length).toEqual(1);
         expect(abbreviationSpec.tokens[0].value)
             .toEqual(expectedAbbreviationString);
         expect(abbreviationSpec.tokens[0].isKeyword).toEqual(false);
         expect(abbreviationSpec.eraserSequence)
             .toEqual(repeatVirtualKey(
                 VIRTUAL_KEY.BACKSPACE, expectdEraserSequenceLength));
         expect(abbreviationSpec.lineageId.length).toBeGreaterThan(0);
         expect(inputAbbreviationChangeEvents[0].requestExpansion)
             .toEqual(true);
       });
  }

  for (const
           [keySequence, reconstructedText, expectedAbbreviationString,
            expectedEraserSequenceLength] of
               [[['x', 'y'], 'xy  ', 'xy', 2],
                [['x', 'y', VIRTUAL_KEY.SPACE], 'xy ', 'xy', 3],
                [[VIRTUAL_KEY.SPACE, 'x', 'y'], ' xy ', 'xy', 3],
  ] as Array<[string[], string, string, number]>) {
    it(`clicking expand button triggers AE: ` +
           `key sequence: ${JSON.stringify(keySequence)}`,
       () => {
         enterKeysIntoComponent(keySequence, reconstructedText);
         const expandbutton =
             fixture.debugElement.query(By.css('.expand-button'));
         expandbutton.nativeElement.click();
         fixture.detectChanges();

         expect(inputAbbreviationChangeEvents.length).toEqual(1);
         const {abbreviationSpec} = inputAbbreviationChangeEvents[0];
         expect(abbreviationSpec.readableString)
             .toEqual(expectedAbbreviationString);
         expect(abbreviationSpec.tokens.length).toEqual(1);
         expect(abbreviationSpec.tokens[0].value)
             .toEqual(expectedAbbreviationString);
         expect(abbreviationSpec.tokens[0].isKeyword).toEqual(false);
         expect(abbreviationSpec.eraserSequence)
             .toEqual(repeatVirtualKey(
                 VIRTUAL_KEY.BACKSPACE, expectedEraserSequenceLength));
         expect(abbreviationSpec.lineageId.length).toBeGreaterThan(0);
         expect(inputAbbreviationChangeEvents[0].requestExpansion)
             .toEqual(true);
       });
  }

  it('long input abbreviation disables AE buttons and shows notice', () => {
    // Length 11.
    const keySequence = ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h', 'i', 'j', 'k'];
    const reconstructedText = keySequence.join('');
    enterKeysIntoComponent(keySequence, reconstructedText);

    expect(fixture.debugElement.query(By.css('.expand-button'))).toBeNull();
    expect(fixture.debugElement.query(By.css('.spell-button'))).toBeNull();
    expect(fixture.debugElement.query(By.css('.abort-button'))).not.toBeNull();
    expect(fixture.debugElement.query(By.css('.length-limit-exceeded')))
        .not.toBeNull();
  });

  it('long input abbreviation followed by trigger sequence does not trigger AE',
     () => {
       // Length 11, excluding the two space keys.
       const keySequence = [
         'a', 'b', 'c', 'd', 'e', 'f', 'g', 'h', 'i', 'j', 'k',
         VIRTUAL_KEY.SPACE, VIRTUAL_KEY.SPACE
       ];
       const reconstructedText = keySequence.join('');
       enterKeysIntoComponent(keySequence, reconstructedText);

       expect(inputAbbreviationChangeEvents.length).toEqual(0);
     });

  it('input abbreviation with head keywords triggers AE', () => {
    const keySequence = [
      'a', VIRTUAL_KEY.SPACE, 'g', 'o', 'o', 'd', VIRTUAL_KEY.SPACE, 't', 'i',
      'a', 't', 'h', 's', VIRTUAL_KEY.SPACE, VIRTUAL_KEY.SPACE
    ];
    const reconstructedText = keySequence.join('');
    enterKeysIntoComponent(keySequence, reconstructedText);

    expect(inputAbbreviationChangeEvents.length).toEqual(1);
    expect(inputAbbreviationChangeEvents[0].requestExpansion).toBeTrue();
    const {abbreviationSpec} = inputAbbreviationChangeEvents[0];
    expect(abbreviationSpec.readableString).toEqual('a good tiaths');
    const {tokens} = abbreviationSpec;
    expect(tokens.length).toEqual(3);
    expect(tokens[0]).toEqual({value: 'a', isKeyword: true});
    expect(tokens[1]).toEqual({value: 'good', isKeyword: true});
    expect(tokens[2]).toEqual({value: 'tiaths', isKeyword: false});
    expect(abbreviationSpec.lineageId.length).toBeGreaterThan(0);
    expect(abbreviationSpec.eraserSequence)
        .toEqual(repeatVirtualKey(VIRTUAL_KEY.BACKSPACE, keySequence.length));
  });

  it('too many head keywords disable expand and spell buttons', () => {
    const keySequence = [
      'a', VIRTUAL_KEY.SPACE, 'b', 'i', 'g', VIRTUAL_KEY.SPACE, 'a', 'n', 'd',
      VIRTUAL_KEY.SPACE, 'r', 'e', 'd', VIRTUAL_KEY.SPACE, 'a', 'n',
      'd',  // Five keywords up to this point.
      VIRTUAL_KEY.SPACE, 'd'
    ];
    const reconstructedText = keySequence.join('');
    enterKeysIntoComponent(keySequence, reconstructedText);

    expect(fixture.debugElement.query(By.css('.expand-button'))).toBeNull();
    expect(fixture.debugElement.query(By.css('.spell-button'))).toBeNull();
    expect(fixture.debugElement.query(By.css('.abort-button'))).not.toBeNull();
    expect(fixture.debugElement.query(By.css('.length-limit-exceeded')))
        .not.toBeNull();
  });

  it('clicking abort button clears state: no head keywords', () => {
    const keySequence = [
      'a', VIRTUAL_KEY.SPACE, 'b', 'i', 'g', VIRTUAL_KEY.SPACE, 'a', 'n', 'd',
      VIRTUAL_KEY.SPACE, 'r', 'e', 'd', VIRTUAL_KEY.SPACE, 'a'
    ];
    const reconstructedText = keySequence.join('');
    enterKeysIntoComponent(keySequence, reconstructedText);
    const abortButton = fixture.debugElement.query(By.css('.abort-button'));
    abortButton.nativeElement.click();
    fixture.detectChanges();

    const inputText = fixture.debugElement.query(By.css('.input-text'));
    expect(inputText.nativeElement.innerText).toEqual('');
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
    const keySequence = ['a', 'c', 'e'];
    const reconstructedText = keySequence.join('');
    enterKeysIntoComponent(keySequence, reconstructedText);
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
    expect(fixture.debugElement.query(By.css('.expand-button'))).toBeNull();
    expect(fixture.debugElement.query(By.css('.spell-button'))).toBeNull();
    expect(fixture.debugElement.query(By.css('.length-limit-exceeded')))
    expect(fixture.debugElement.query(By.css('.abort-button'))).not.toBeNull();
    expect(LoadLexiconRequests.length).toEqual(0);
  });

  it('spelling word updates chips', () => {
    const keySequence = ['a', 'b', 'c'];
    const reconstructedText = keySequence.join('');
    enterKeysIntoComponent(keySequence, reconstructedText);
    const spellButton = fixture.debugElement.query(By.css('.spell-button'));
    spellButton.nativeElement.click();
    fixture.detectChanges();
    const spellSequence = ['b', 'i', 't'];
    const spellReconstructedText = reconstructedText + spellSequence.join('');
    enterKeysIntoComponent(spellSequence, spellReconstructedText, 3);

    const chips =
        fixture.debugElement.queryAll(By.css('app-input-bar-chip-component'));
    expect(chips.length).toEqual(3);
    expect((chips[0].componentInstance as InputBarChipComponent).text)
        .toEqual('a');
    expect((chips[1].componentInstance as InputBarChipComponent).text)
        .toEqual('bit');
    expect((chips[2].componentInstance as InputBarChipComponent).text)
        .toEqual('c');
    expect(fixture.debugElement.query(By.css('.expand-button'))).not.toBeNull();
    expect(fixture.debugElement.query(By.css('.spell-button'))).toBeNull();
    expect(fixture.debugElement.query(By.css('.length-limit-exceeded')))
    expect(fixture.debugElement.query(By.css('.abort-button'))).not.toBeNull();
    expect(inputAbbreviationChangeEvents.length).toEqual(0);
    expect(LoadLexiconRequests.length).toEqual(1);
    expect(LoadLexiconRequests[0]).toEqual({prefix: 'b'});
  });

  for (const triggerKey of [VIRTUAL_KEY.SPACE, VIRTUAL_KEY.ENTER]) {
    it('spelling word then enter trigger key triggers AE: ' +
           `trigger key = ${triggerKey}`,
       () => {
         const keySequence = ['a', 'b', 'c'];
         const reconstructedText = keySequence.join('');
         enterKeysIntoComponent(keySequence, reconstructedText);
         const spellButton =
             fixture.debugElement.query(By.css('.spell-button'));
         spellButton.nativeElement.click();
         fixture.detectChanges();
         const spellSequence = ['b', 'i', 't', VIRTUAL_KEY.SPACE];
         const spellReconstructedText =
             spellSequence.join('') + reconstructedText;
         enterKeysIntoComponent(spellSequence, spellReconstructedText);

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

  it('clicking expand button after spelling triggers AE', () => {
    const keySequence = ['a', 'b', 'c'];
    const reconstructedText = keySequence.join('');
    enterKeysIntoComponent(keySequence, reconstructedText);
    const spellButton = fixture.debugElement.query(By.css('.spell-button'));
    spellButton.nativeElement.click();
    fixture.detectChanges();
    const spellSequence = ['b', 'i', 't'];
    const spellReconstructedText = spellSequence.join('') + reconstructedText;
    enterKeysIntoComponent(spellSequence, spellReconstructedText);
    const expandButton = fixture.debugElement.query(By.css('.expand-button'));
    expandButton.nativeElement.click();

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

  it('clicking chip then spell and trigger AE works', () => {
    const keySequence = ['a', 'b', 'a'];
    const reconstructedText = keySequence.join('');
    enterKeysIntoComponent(keySequence, reconstructedText);
    const spellButton = fixture.debugElement.query(By.css('.spell-button'));
    spellButton.nativeElement.click();
    fixture.detectChanges();
    const chips =
        fixture.debugElement.queryAll(By.css('app-input-bar-chip-component'));
    chips[2].nativeElement.click();
    fixture.detectChanges();
    const spellSequence = ['a', 'c', 'k', VIRTUAL_KEY.SPACE];
    const spellReconstructedText = reconstructedText + spellSequence.join('');
    enterKeysIntoComponent(spellSequence, spellReconstructedText, 3);

    expect(inputAbbreviationChangeEvents.length).toEqual(1);
    expect(inputAbbreviationChangeEvents[0].requestExpansion).toBeTrue();
    const {abbreviationSpec} = inputAbbreviationChangeEvents[0];
    expect(abbreviationSpec.tokens.length).toEqual(2);
    expect(abbreviationSpec.readableString).toEqual('ab ack');
    // TODO(cais): Make assertion about eraseSequence with spelling, after
    // fixing the logic.
    const {tokens} = abbreviationSpec;
    expect(tokens[0]).toEqual({value: 'ab', isKeyword: false});
    expect(tokens[1]).toEqual({value: 'ack', isKeyword: true});
    expect(LoadLexiconRequests.length).toEqual(1);
    expect(LoadLexiconRequests[0]).toEqual({prefix: 'a'});
  });

  it('irrelevant keypresses during spelling are ignored', () => {
    const keySequence = ['a', 'b', 'c'];
    const reconstructedText = keySequence.join('');
    enterKeysIntoComponent(keySequence, reconstructedText);
    const spellButton = fixture.debugElement.query(By.css('.spell-button'));
    spellButton.nativeElement.click();
    fixture.detectChanges();
    // The first three keys ('x', 'y' and 'z') are irrelevant and hence must be
    // ignored.
    const spellSequence = ['x', 'y', 'z', 'b', 'i', 't'];
    const spellReconstructedText = reconstructedText + spellSequence.join('');
    enterKeysIntoComponent(spellSequence, spellReconstructedText, 3);

    const chips =
        fixture.debugElement.queryAll(By.css('app-input-bar-chip-component'));
    expect(chips.length).toEqual(3);
    expect((chips[0].componentInstance as InputBarChipComponent).text)
        .toEqual('a');
    expect((chips[1].componentInstance as InputBarChipComponent).text)
        .toEqual('bit');
    expect((chips[2].componentInstance as InputBarChipComponent).text)
        .toEqual('c');

    const expandButton = fixture.debugElement.query(By.css('.expand-button'));
    expandButton.nativeElement.click();
    expect(inputAbbreviationChangeEvents.length).toEqual(1);
    expect(inputAbbreviationChangeEvents[0].requestExpansion).toBeTrue();
    const {abbreviationSpec} = inputAbbreviationChangeEvents[0];
    expect(abbreviationSpec.readableString).toEqual('a bit c');
    expect(abbreviationSpec.tokens.length).toEqual(3);
    // TODO(cais): Sort out the eraser sequence when there are irrelevant keys.
    // expect(abbreviationSpec.eraserSequence)
    //     .toEqual(repeatVirtualKey(VIRTUAL_KEY.BACKSPACE, 9));
  });

  it('ambiguous keypress during spelling are ignored', () => {
    const keySequence = ['c', 'b', 'c'];  // Noticie the duplicate letters c.
    const reconstructedText = keySequence.join('');
    enterKeysIntoComponent(keySequence, reconstructedText);
    const spellButton = fixture.debugElement.query(By.css('.spell-button'));
    spellButton.nativeElement.click();
    fixture.detectChanges();
    const spellSequence = ['c', 'c', 'c'];
    const spellReconstructedText = reconstructedText + spellSequence.join('');
    enterKeysIntoComponent(spellSequence, spellReconstructedText, 3);

    const chips =
        fixture.debugElement.queryAll(By.css('app-input-bar-chip-component'));
    expect(chips.length).toEqual(3);
    expect(chips.length).toEqual(3);
    expect((chips[0].componentInstance as InputBarChipComponent).text)
        .toEqual('c');
    expect((chips[1].componentInstance as InputBarChipComponent).text)
        .toEqual('b');
    expect((chips[2].componentInstance as InputBarChipComponent).text)
        .toEqual('c');
  });

  it('clicking abort after clicking spell resets state', () => {
    const keySequence = ['a', 'b', 'a'];
    const reconstructedText = keySequence.join('');
    enterKeysIntoComponent(keySequence, reconstructedText);
    const spellButton = fixture.debugElement.query(By.css('.spell-button'));
    spellButton.nativeElement.click();
    fixture.detectChanges();
    const abortButton = fixture.debugElement.query(By.css('.abort-button'));
    abortButton.nativeElement.click();
    fixture.detectChanges();

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
    expect(abbreviationSpec.tokens[0].value).toEqual('aba');
    expect(abbreviationSpec.tokens[0].isKeyword).toBeFalse();
    expect(abbreviationSpec.readableString).toEqual('aba');
  });

  it('clicking abort during spelling resets state', () => {
    const keySequence = ['a', 'b', 'a'];
    const reconstructedText = keySequence.join('');
    enterKeysIntoComponent(keySequence, reconstructedText);
    const spellButton = fixture.debugElement.query(By.css('.spell-button'));
    spellButton.nativeElement.click();
    fixture.detectChanges();
    const chips =
        fixture.debugElement.queryAll(By.css('app-input-bar-chip-component'));
    chips[2].nativeElement.click();
    fixture.detectChanges();
    const spellSequence = ['a', 'c', 'k'];
    const spellReconstructedText = reconstructedText + spellSequence.join('');
    enterKeysIntoComponent(spellSequence, spellReconstructedText, 3);
    const abortButton = fixture.debugElement.query(By.css('.abort-button'));
    abortButton.nativeElement.click();
    fixture.detectChanges();

    expect(fixture.debugElement.queryAll(By.css('app-input-bar-chip-component'))
               .length)
        .toEqual(0);

    expect(fixture.debugElement.query(By.css('.expand-button'))).not.toBeNull();
    expect(fixture.debugElement.query(By.css('.spell-button'))).not.toBeNull();
    const expandButton = fixture.debugElement.query(By.css('.expand-button'));
    expandButton.nativeElement.click();

    expect(inputAbbreviationChangeEvents.length).toEqual(1);
    expect(inputAbbreviationChangeEvents[0].requestExpansion).toBeTrue();
    const {abbreviationSpec} = inputAbbreviationChangeEvents[0];
    expect(abbreviationSpec.tokens.length).toEqual(1);
    expect(abbreviationSpec.tokens[0].value).toEqual('aba');
    expect(abbreviationSpec.tokens[0].isKeyword).toBeFalse();
    expect(abbreviationSpec.readableString).toEqual('aba');
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

  it('clicking chip during refinement triggers fillMask', () => {
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
        }
      ]
    });
    fixture.detectChanges();
    const keySequence = ['f', 'e', 'l', 't', VIRTUAL_KEY.SPACE];
    const reconstructedText = keySequence.join('');
    const chips =
        fixture.debugElement.queryAll(By.css('app-input-bar-chip-component'))
    chips[1].nativeElement.click();
    enterKeysIntoComponent(keySequence, reconstructedText);
    const speakButton = fixture.debugElement.query(By.css('.speak-button'))
                            .query(By.css('.speak-button'));
    speakButton.nativeElement.click();

    expect(textEntryEndEvents.length).toEqual(1);
    expect(textEntryEndEvents[0].text).toEqual('i felt great');
  });

  // TODO(cais): Test spelling valid word triggers AE, with debounce.
  // TODO(cais): Backspaces during spelling.
  // TODO(cais): Test favorite button.
});
