/** Unit tests for the SpellComponent. */
import {HttpClientModule} from '@angular/common/http';
import {SimpleChange} from '@angular/core';
import {ComponentFixture, TestBed} from '@angular/core/testing';
import {By} from '@angular/platform-browser';
import {Subject} from 'rxjs';
import {createUuid} from 'src/utils/uuid';

import * as cefSharp from '../../utils/cefsharp';
import {repeatVirtualKey, VIRTUAL_KEY} from '../external/external-events.component';
import {TestListener} from '../test-utils/test-cefsharp-listener';
import {AbbreviationSpec, AbbreviationToken, InputAbbreviationChangedEvent} from '../types/abbreviation';

import {SpellComponent, SpellingState} from './spell.component';
import {SpellModule} from './spell.module';

fdescribe('SpellComponent', () => {
  let abbreviationExpansionTriggers: Subject<InputAbbreviationChangedEvent>;
  let fixture: ComponentFixture<SpellComponent>;
  let testListener: TestListener;
  let abbreviationChangeEvents: InputAbbreviationChangedEvent[];

  beforeEach(async () => {
    testListener = new TestListener();
    (window as any)[cefSharp.BOUND_LISTENER_NAME] = testListener;
    await TestBed
        .configureTestingModule({
          imports: [SpellModule, HttpClientModule],
          declarations: [SpellComponent],
        })
        .compileComponents();
    abbreviationExpansionTriggers = new Subject();
    abbreviationChangeEvents = [];
    abbreviationExpansionTriggers.subscribe(
        (event) => abbreviationChangeEvents.push(event));
    fixture = TestBed.createComponent(SpellComponent);
  });

  afterEach(() => {
    if ((window as any).externalKeypressHook !== undefined) {
      delete (window as any).externalKeypressHook;
    }
  });

  function getAbbreviationSpecForTest(initialLetters: string[]):
      AbbreviationSpec {
    const tokens: AbbreviationToken[] = [];
    for (const letter of initialLetters) {
      tokens.push({
        value: letter,
        isKeyword: false,
      });
    }
    return {
      tokens,
      readableString: initialLetters.join(''),
      eraserSequence:
          repeatVirtualKey(VIRTUAL_KEY.BACKSPACE, initialLetters.length + 2),
      lineageId: createUuid(),
    };
  }

  it('initial state is CHOOSING_TOKEN', () => {
    expect(fixture.componentInstance.state)
        .toEqual(SpellingState.CHOOSING_TOKEN);
  });

  it('displays initial letters given original abbreviaton spec', () => {
    fixture.componentInstance.originalAbbreviationSpec =
        getAbbreviationSpecForTest(['a', 'b', 'c']);
    fixture.componentInstance.spellIndex = 1;
    fixture.detectChanges();
    fixture.componentInstance.listenToKeypress(
        ['a', 'b', 'c', ' ', ' ', 'b'], 'abc  b');
    fixture.detectChanges();

    expect(fixture.componentInstance.state)
        .toEqual(SpellingState.SPELLING_TOKEN);
    const tokenButtons =
        fixture.debugElement.queryAll(By.css('.abbreviated-token'));
    // Spelling has started on 'b' (the 2nd letter). There should be buttons
    // for the two remaining letters ('a' and 'c').
    expect(tokenButtons.length).toEqual(2);
    expect(tokenButtons[0].nativeElement.innerText).toEqual('a');
    expect(tokenButtons[1].nativeElement.innerText).toEqual('c');
    const spellInputs = fixture.debugElement.queryAll(By.css('.spell-input'));
    expect(spellInputs.length).toEqual(1);
    expect(spellInputs[0].nativeElement.value).toEqual('b');
  });

  it('typing letters for spelled word populates spell input', () => {
    fixture.componentInstance.originalAbbreviationSpec =
        getAbbreviationSpecForTest(['a', 'b', 'c']);
    fixture.componentInstance.spellIndex = 1;
    fixture.detectChanges();
    fixture.componentInstance.listenToKeypress(
        ['a', 'b', 'c', ' ', ' ', 'b'], 'abc  b');
    fixture.componentInstance.listenToKeypress(
        ['a', 'b', 'c', ' ', ' ', 'b', 'i'], 'abc  bi');
    fixture.componentInstance.listenToKeypress(
        ['a', 'b', 'c', ' ', ' ', 'b', 'i', 't'], 'abc  bit');
    fixture.detectChanges();

    const spellInput = fixture.debugElement.query(By.css('.spell-input'));
    expect(spellInput.nativeElement.value).toEqual('bit');
  });

  it('typing with Backspace for spelled word populates spell input', () => {
    fixture.componentInstance.originalAbbreviationSpec =
        getAbbreviationSpecForTest(['a', 'b', 'c']);
    fixture.componentInstance.spellIndex = 1;
    fixture.detectChanges();
    fixture.componentInstance.listenToKeypress(
        ['a', 'b', 'c', ' ', ' ', 'b'], 'abc  b');
    fixture.componentInstance.listenToKeypress(
        ['a', 'b', 'c', ' ', ' ', 'b', 'i'], 'abc  bi');
    fixture.componentInstance.listenToKeypress(
        ['a', 'b', 'c', ' ', ' ', 'b', 'i', VIRTUAL_KEY.BACKSPACE], 'abc  b');
    fixture.componentInstance.listenToKeypress(
        ['a', 'b', 'c', ' ', ' ', 'b', 'i', VIRTUAL_KEY.BACKSPACE, 'y'],
        'abc  by');
    fixture.detectChanges();

    const spellInput = fixture.debugElement.query(By.css('.spell-input'));
    expect(spellInput.nativeElement.value).toEqual('by');
  });

  for (const triggerKey of [' ', VIRTUAL_KEY.ENTER]) {
    it(`typing followed by space triggers new abbreviation ` +
           `expansion: trigger key = ${triggerKey}`,
       () => {
         const emittedAbbreviationSpecs: AbbreviationSpec[] = [];
         fixture.componentInstance.newAbbreviationSpec.subscribe(
             spec => emittedAbbreviationSpecs.push(spec));
         fixture.componentInstance.originalAbbreviationSpec =
             getAbbreviationSpecForTest(['a', 'b', 'c']);
         fixture.componentInstance.spellIndex = 1;
         fixture.detectChanges();
         fixture.componentInstance.listenToKeypress(
             ['a', 'b', 'c', ' ', ' ', 'b'], 'abc  b');
         fixture.componentInstance.listenToKeypress(
             ['a', 'b', 'c', ' ', ' ', 'b', 'i'], 'abc  bi');
         fixture.componentInstance.listenToKeypress(
             ['a', 'b', 'c', ' ', ' ', 'b', 'i', 't'], 'abc  bit');
         const finalText =
             'abc  bit' + (triggerKey === VIRTUAL_KEY.ENTER ? '\n' : ' ');
         fixture.componentInstance.listenToKeypress(
             ['a', 'b', 'c', ' ', ' ', 'b', 'i', 't', triggerKey], finalText);
         fixture.detectChanges();

         expect(fixture.componentInstance.state).toEqual(SpellingState.DONE);
         expect(fixture.componentInstance.spelledWords).toEqual([
           null, 'bit', null
         ]);
         expect(emittedAbbreviationSpecs.length).toEqual(1);
         expect(emittedAbbreviationSpecs[0].tokens.length).toEqual(3);
         expect(emittedAbbreviationSpecs[0].tokens[0]).toEqual({
           value: 'a',
           isKeyword: false,
         });
         expect(emittedAbbreviationSpecs[0].tokens[1]).toEqual({
           value: 'bit',
           isKeyword: true,
         });
         expect(emittedAbbreviationSpecs[0].tokens[2]).toEqual({
           value: 'c',
           isKeyword: false,
         });
         expect(emittedAbbreviationSpecs[0].readableString).toEqual('a bit c');
         expect(emittedAbbreviationSpecs[0].eraserSequence)
             .toEqual(repeatVirtualKey(VIRTUAL_KEY.BACKSPACE, 5 + 4));
         const tokenButtons =
             fixture.debugElement.queryAll(By.css('.abbreviated-token'));
         expect(tokenButtons.length).toEqual(3);
         expect(tokenButtons[0].nativeElement.innerText).toEqual('a');
         expect(tokenButtons[1].nativeElement.innerText).toEqual('bit');
         expect(tokenButtons[2].nativeElement.innerText).toEqual('c');
       });
  }

  it('Clicking done button triggers AE', () => {
    const emittedAbbreviationSpecs: AbbreviationSpec[] = [];
    fixture.componentInstance.newAbbreviationSpec.subscribe(
        spec => emittedAbbreviationSpecs.push(spec));
    fixture.componentInstance.originalAbbreviationSpec =
        getAbbreviationSpecForTest(['a', 'b', 'c']);
    fixture.componentInstance.spellIndex = 1;
    fixture.detectChanges();
    fixture.componentInstance.listenToKeypress(
        ['a', 'b', 'c', ' ', ' ', 'c'], 'abc  c');
    fixture.componentInstance.listenToKeypress(
        ['a', 'b', 'c', ' ', ' ', 'c', 'o'], 'abc  co');
    fixture.componentInstance.listenToKeypress(
        ['a', 'b', 'c', ' ', ' ', 'c', 'o', 'l'], 'abc  col');
    fixture.componentInstance.listenToKeypress(
        ['a', 'b', 'c', ' ', ' ', 'c', 'o', 'l', 'd'], 'abc  cold');
    const doneButton = fixture.debugElement.query(By.css('.done-button'));
    (doneButton.nativeElement as HTMLButtonElement).click();
    fixture.detectChanges();

    expect(fixture.componentInstance.state).toEqual(SpellingState.DONE);
    expect(fixture.componentInstance.spelledWords).toEqual([
      null, null, 'cold'
    ]);
    expect(emittedAbbreviationSpecs.length).toEqual(1);
    expect(emittedAbbreviationSpecs[0].tokens).toEqual([
      {
        value: 'ab',
        isKeyword: false,
      },
      {
        value: 'cold',
        isKeyword: true,
      }
    ]);
    expect(emittedAbbreviationSpecs[0].readableString).toEqual('ab cold');
    expect(emittedAbbreviationSpecs[0].eraserSequence)
        .toEqual(repeatVirtualKey(VIRTUAL_KEY.BACKSPACE, 5 + 4));
  });

  it(`supports spelling 2nd word after spelling the first`, () => {
    const emittedAbbreviationSpecs: AbbreviationSpec[] = [];
    fixture.componentInstance.newAbbreviationSpec.subscribe(
        spec => emittedAbbreviationSpecs.push(spec));
    fixture.componentInstance.originalAbbreviationSpec =
        getAbbreviationSpecForTest(['a', 'b', 'c']);
    fixture.componentInstance.spellIndex = 1;
    fixture.detectChanges();
    fixture.componentInstance.listenToKeypress(
        ['a', 'b', 'c', ' ', ' ', 'b'], 'abc  b');
    fixture.componentInstance.listenToKeypress(
        ['a', 'b', 'c', ' ', ' ', 'b', 'i'], 'abc  bi');
    fixture.componentInstance.listenToKeypress(
        ['a', 'b', 'c', ' ', ' ', 'b', 'i', 't'], 'abc  bit');
    fixture.componentInstance.listenToKeypress(
        ['a', 'b', 'c', ' ', ' ', 'b', 'i', 't', ' '], 'abc  bit ');
    fixture.componentInstance.listenToKeypress(
        ['a', 'b', 'c', ' ', ' ', 'b', 'i', 't', ' ', 'c'], 'abc  bit c');
    fixture.componentInstance.listenToKeypress(
        ['a', 'b', 'c', ' ', ' ', 'b', 'i', 't', ' ', 'c', 'o'], 'abc  bit co');
    fixture.componentInstance.listenToKeypress(
        ['a', 'b', 'c', ' ', ' ', 'b', 'i', 't', ' ', 'c', 'o', 'l'],
        'abc  bit col');
    fixture.componentInstance.listenToKeypress(
        ['a', 'b', 'c', ' ', ' ', 'b', 'i', 't', ' ', 'c', 'o', 'l', 'd'],
        'abc  bit cold');
    fixture.componentInstance.listenToKeypress(
        ['a', 'b', 'c', ' ', ' ', 'b', 'i', 't', ' ', 'c', 'o', 'l', 'd', ' '],
        'abc  bit cold ');
    fixture.detectChanges();

    expect(fixture.componentInstance.state).toEqual(SpellingState.DONE);
    expect(fixture.componentInstance.spelledWords).toEqual([
      null, 'bit', 'cold'
    ]);
    expect(emittedAbbreviationSpecs.length).toEqual(2);
    expect(emittedAbbreviationSpecs[1].tokens).toEqual([
      {
        value: 'a',
        isKeyword: false,
      },
      {
        value: 'bit',
        isKeyword: true,
      },
      {
        value: 'cold',
        isKeyword: true,
      }
    ]);
    expect(emittedAbbreviationSpecs[1].readableString).toEqual('a bit cold');
    expect(emittedAbbreviationSpecs[1].eraserSequence)
        .toEqual(repeatVirtualKey(VIRTUAL_KEY.BACKSPACE, 5 + 4 + 5));
    const tokenButtons =
        fixture.debugElement.queryAll(By.css('.abbreviated-token'));
    expect(tokenButtons.length).toEqual(3);
    expect(tokenButtons[0].nativeElement.innerText).toEqual('a');
    expect(tokenButtons[1].nativeElement.innerText).toEqual('bit');
    expect(tokenButtons[2].nativeElement.innerText).toEqual('cold');
  });

  it('supports 2nd spelling after 1st one: different letters', () => {
    const emittedAbbreviationSpecs: AbbreviationSpec[] = [];

    fixture.componentInstance.newAbbreviationSpec.subscribe(
        spec => emittedAbbreviationSpecs.push(spec));
    const oldAbbreviationSpec = getAbbreviationSpecForTest(['a', 'b'])
    fixture.componentInstance.originalAbbreviationSpec = oldAbbreviationSpec;
    fixture.componentInstance.spellIndex = 0;
    fixture.componentInstance.ngOnInit();
    fixture.componentInstance.listenToKeypress(
        ['a', 'b', 'c', ' ', ' ', 'a'], 'abc  a');
    fixture.componentInstance.listenToKeypress(
        ['a', 'b', 'c', ' ', ' ', 'a', 'l'], 'abc  al');
    fixture.componentInstance.listenToKeypress(
        ['a', 'b', 'c', ' ', ' ', 'a', 'l', 'l'], 'abc  all');
    fixture.componentInstance.listenToKeypress(
        ['a', 'b', 'c', ' ', ' ', 'a', 'l', 'l', ' '], 'abc  all ');
    fixture.detectChanges();
    // Set up the second AE spelling.
    const newAbbreviationSpec = getAbbreviationSpecForTest(['s', 'c'])
    fixture.componentInstance.originalAbbreviationSpec = newAbbreviationSpec;
    fixture.componentInstance.spellIndex = 1;
    fixture.detectChanges();
    fixture.componentInstance.ngOnChanges({
      originalAbbreviationSpec: new SimpleChange(
          oldAbbreviationSpec, newAbbreviationSpec, /* firstChange= */ true),
    });
    fixture.componentInstance.listenToKeypress(
        ['a', 'b', 'c', ' ', ' ', 'a', 'l', 'l', ' ', 's', 'c', ' ', ' '],
        'abc  all sc  ');
    fixture.componentInstance.listenToKeypress(
        ['a', 'b', 'c', ' ', ' ', 'a', 'l', 'l', ' ', 's', 'c', ' ', ' ', 'c'],
        'abc  all sc  c');
    fixture.detectChanges();

    expect(fixture.componentInstance.state)
        .toEqual(SpellingState.SPELLING_TOKEN);
    const tokenButtons =
        fixture.debugElement.queryAll(By.css('.abbreviated-token'));
    // Spelling has started on 'c' (the 2nd letter). There should be one button
    // for the 1st letter ('s').
    expect(tokenButtons.length).toEqual(1);
    expect(tokenButtons[0].nativeElement.innerText).toEqual('s');
    const spellInputs = fixture.debugElement.queryAll(By.css('.spell-input'));
    expect(spellInputs.length).toEqual(1);
    expect(spellInputs[0].nativeElement.value).toEqual('c');
  });

  it('supports 2nd spelling after 1st one: same letter twice', () => {
    const emittedAbbreviationSpecs: AbbreviationSpec[] = [];
    fixture.componentInstance.newAbbreviationSpec.subscribe(
        spec => emittedAbbreviationSpecs.push(spec));
    const oldAbbreviationSpec = getAbbreviationSpecForTest(['a', 'b'])
    fixture.componentInstance.originalAbbreviationSpec = oldAbbreviationSpec;
    fixture.componentInstance.spellIndex = 0;
    fixture.componentInstance.ngOnInit();
    fixture.componentInstance.listenToKeypress(
        ['a', 'b', 'c', ' ', ' ', 'a'], 'abc  a');
    fixture.componentInstance.listenToKeypress(
        ['a', 'b', 'c', ' ', ' ', 'a', 'l'], 'abc  al');
    fixture.componentInstance.listenToKeypress(
        ['a', 'b', 'c', ' ', ' ', 'a', 'l', 'l'], 'abc  all');
    fixture.componentInstance.listenToKeypress(
        ['a', 'b', 'c', ' ', ' ', 'a', 'l', 'l', ' '], 'abc  all ');
    fixture.detectChanges();
    // Set up the second AE spelling.
    fixture.componentInstance.listenToKeypress(
        ['a', 'b', 'c', ' ', ' ', 'a', 'l', 'l', ' ', 'a'], 'abc  all a');
    fixture.componentInstance.listenToKeypress(
        ['a', 'b', 'c', ' ', ' ', 'a', 'l', 'l', ' ', 'a', 't'], 'abc  all at');
    fixture.componentInstance.listenToKeypress(
        ['a', 'b', 'c', ' ', ' ', 'a', 'l', 'l', ' ', 'a', 't', ' '],
        'abc  all at ');
    fixture.detectChanges();

    expect(fixture.componentInstance.state).toEqual(SpellingState.DONE);
    expect(fixture.componentInstance.spelledWords).toEqual([
      'at',
      null,
    ]);
    expect(emittedAbbreviationSpecs.length).toEqual(2);
    expect(emittedAbbreviationSpecs[1].tokens).toEqual([
      {
        value: 'at',
        isKeyword: true,
      },
      {
        value: 'b',
        isKeyword: false,
      }
    ]);
    expect(emittedAbbreviationSpecs[1].readableString).toEqual('at b');
    expect(emittedAbbreviationSpecs[1].eraserSequence)
        .toEqual(repeatVirtualKey(VIRTUAL_KEY.BACKSPACE, 11));
  });

  it('registers buttons on spelling', async () => {
    fixture.componentInstance.originalAbbreviationSpec =
        getAbbreviationSpecForTest(['a', 'b', 'c']);
    fixture.componentInstance.spellIndex = 1;
    fixture.detectChanges();
    fixture.componentInstance.listenToKeypress(
        ['a', 'b', 'c', ' ', ' ', 'b'], 'abc  b');
    fixture.detectChanges();
    await fixture.whenStable();

    expect(testListener.updateButtonBoxesCalls.length)
        .toBeGreaterThanOrEqual(1);
    const lastCall =
        testListener
            .updateButtonBoxesCalls[testListener.updateButtonBoxesCalls.length - 1];
    expect(lastCall[0].indexOf('SpellComponent_')).toEqual(0);
    expect(lastCall[1].length).toEqual(3);
  });

  it('clicking token button starts spelling: no duplicate letters', () => {
    const keyCodeValues: number[][] = [];
    (window as any).externalKeypressHook = (keyCode: number[]) => {
      keyCodeValues.push(keyCode);
    };
    fixture.componentInstance.originalAbbreviationSpec =
        getAbbreviationSpecForTest(['a', 'b', 'c']);
    fixture.componentInstance.state = SpellingState.SPELLING_TOKEN;
    fixture.detectChanges();

    const tokenButtons =
        fixture.debugElement.queryAll(By.css('.abbreviated-token'));
    (tokenButtons[1].nativeElement as HTMLButtonElement).click();
    expect(fixture.componentInstance.spellIndex).toEqual(1);
    expect(fixture.componentInstance.tokenSpellingInput).toEqual('b');
    // Clicking the button shouldn't trigger programmatic keystrokes.
    expect(keyCodeValues).toEqual([]);
  });

  it('clicking token button starts spelling: has duplicate letters', () => {
    const keyCodeValues: number[][] = [];
    (window as any).externalKeypressHook = (keyCode: number[]) => {
      keyCodeValues.push(keyCode);
    };
    fixture.componentInstance.originalAbbreviationSpec =
        getAbbreviationSpecForTest(['a', 'b', 'c', 'a']);
    fixture.componentInstance.state = SpellingState.SPELLING_TOKEN;
    fixture.detectChanges();

    const tokenButtons =
        fixture.debugElement.queryAll(By.css('.abbreviated-token'));
    (tokenButtons[3].nativeElement as HTMLButtonElement).click();
    expect(fixture.componentInstance.spellIndex).toEqual(3);
    expect(fixture.componentInstance.tokenSpellingInput).toEqual('a');
    // Clicking the button shouldn't trigger programmatic keystrokes.
    expect(keyCodeValues).toEqual([]);
  });
});
