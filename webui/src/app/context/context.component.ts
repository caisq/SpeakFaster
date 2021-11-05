import {AfterViewInit, Component, ElementRef, EventEmitter, HostListener, Input, OnInit, Output, QueryList, ViewChildren} from '@angular/core';
import {Subject, timer} from 'rxjs';

import {createUuid} from '../..//utils/uuid';
import {updateButtonBoxes} from '../../utils/cefsharp';
import {ContextSignal, SpeakFasterService} from '../speakfaster-service';
import {TextInjection} from '../types/text-injection';

import {ConversationTurnComponent} from './conversation-turn.component';
import {DEFAULT_CONTEXT_SIGNALS} from './default-context';

@Component({
  selector: 'app-context-component',
  templateUrl: './context.component.html',
  providers: [],
})
export class ContextComponent implements OnInit, AfterViewInit {
  private static readonly _NAME = 'ContextComponent';
  // TODO(cais): Do not hardcode this user ID.
  private userId = 'cais';
  private static readonly MAX_FOCUS_CONTEXT_SIGNALS = 2;

  @Input() endpoint!: string;
  @Input() accessToken!: string;
  @Input() textInjectionSubject!: Subject<TextInjection>;

  private static readonly CONTEXT_POLLING_INTERVAL_MILLIS = 2 * 1000;
  readonly contextSignals: ContextSignal[] = [];
  private readonly textInjectionContextSignals: ContextSignal[] = [];
  contextRetrievalError: string|null = null;

  @Output() contextStringsSelected: EventEmitter<string[]> = new EventEmitter();

  @ViewChildren('contextItem')
  viewButtons!: QueryList<ConversationTurnComponent>;

  private readonly focusContextIds: string[] = [];

  constructor(private speakFasterService: SpeakFasterService) {}

  ngOnInit() {
    this.focusContextIds.splice(0);
    this.textInjectionSubject.subscribe((textInjection: TextInjection) => {
      const timestamp = new Date(textInjection.timestampMillis).toISOString();
      this.textInjectionContextSignals.push({
        userId: '',  // TODO(cais): Populate proper user ID.
        conversationTurn: {
          speechContent: textInjection.text,
          startTimestamp: timestamp,
          isTts: true,
        },
        timestamp,
        contextId: createUuid(),
      });
      // TODO(cais): Limit length of textInjections?
      this.retrieveContext();
    });
  }

  ngAfterViewInit() {
    this.viewButtons.changes.subscribe(
        (r: QueryList<ConversationTurnComponent>) => {
          setTimeout(() => {
            const boxes: Array<[number, number, number, number]> = [];
            r.forEach((element) => {
              boxes.push(element.getBox());
            })
            updateButtonBoxes(ContextComponent._NAME, boxes);
          }, 20);
        });
    timer(50, ContextComponent.CONTEXT_POLLING_INTERVAL_MILLIS)
        .subscribe(() => {
          this.retrieveContext();
        });
    // TODO(cais): Do not hardcode delay.
  }

  isContextInFocus(contextId: string): boolean {
    return this.focusContextIds.indexOf(contextId) !== -1;
  }

  onTurnClicked(event: Event, contextId: string) {
    const i = this.focusContextIds.indexOf(contextId);
    if (i === -1) {
      this.focusContextIds.push(contextId);
      this.cleanUpAndSortFocusContextIds();
      for (let i = 0; i < this.contextSignals.length; ++i) {
        if (this.contextSignals[i].contextId === contextId) {
          break;
        }
      }
    } else {
      this.focusContextIds.splice(i, 1);
    }
    this.emitContextStringsSelected();
  }

  // NOTE: document:keydown can prevent the default tab-switching
  // action of Alt + number keys.
  @HostListener('document:keydown', ['$event'])
  onKeydown(event: KeyboardEvent) {
    // event.stopPropagation();
    if (event.ctrlKey && event.key.toLocaleLowerCase() == 'c') {
      // Ctrl C for polling context.
      this.retrieveContext();
      event.preventDefault();
      event.stopPropagation();
    } else if (!event.altKey) {
      return;
    }
    if (event.ctrlKey || event.metaKey || event.shiftKey) {
      return;
    }
    const keyIndex = Number.parseInt(event.key) - 1;
    if (keyIndex >= 0 && keyIndex < this.contextSignals.length) {
      const contextId = this.contextSignals[keyIndex].contextId!;
      if (this.focusContextIds.indexOf(contextId) === -1) {
        this.focusContextIds.push(contextId);
        this.cleanUpAndSortFocusContextIds();
      } else if (
          this.focusContextIds.indexOf(contextId) !== -1 &&
          this.focusContextIds.length > 1) {
        this.focusContextIds.splice(this.focusContextIds.indexOf(contextId), 1);
      }
      event.preventDefault();
      event.stopPropagation();
    }
  }

  private populateConversationTurnWithDefault() {
    this.contextSignals.splice(0);
    this.contextSignals.push(...DEFAULT_CONTEXT_SIGNALS);
    this.appendTextInjectionToContext();
    if (this.contextSignals.length > 0 && this.focusContextIds.length === 0) {
      this.focusContextIds.push(
          this.contextSignals[this.contextSignals.length - 1].contextId!);
      this.cleanUpAndSortFocusContextIds();
    }
    this.emitContextStringsSelected();
  }

  private retrieveContext() {
    this.speakFasterService
        .retrieveContext(this.endpoint, this.accessToken, this.userId)
        .subscribe(
            data => {
              if (data.errorMessage != null) {
                this.contextRetrievalError = data.errorMessage;
                return;
              }
              if (data.contextSignals == null ||
                  data.contextSignals.length === 0) {
                this.populateConversationTurnWithDefault();
                return;
              }
              this.contextSignals.splice(0);  // Empty the array first.
              for (const contextSignal of data.contextSignals) {
                if (contextSignal.timestamp != null &&
                    contextSignal.conversationTurn != null &&
                    contextSignal.conversationTurn.startTimestamp == null) {
                  contextSignal.conversationTurn.startTimestamp =
                      contextSignal.timestamp;
                }
                if (contextSignal.conversationTurn != null) {
                  // TODO(cais): Deduplicate.
                  this.contextSignals.push(contextSignal);
                }
              }
              this.appendTextInjectionToContext();
              this.cleanUpAndSortFocusContextIds();
              // TODO(cais): Discard obsolete context IDs.
              if (this.focusContextIds.length === 0 &&
                  this.contextSignals.length > 0) {
                this.focusContextIds.push(
                    this.contextSignals[this.contextSignals.length - 1]
                        .contextId!);
                this.cleanUpAndSortFocusContextIds();
              }
              this.emitContextStringsSelected();
              this.contextRetrievalError = null;
            },
            error => {
              this.contextSignals.splice(0);  // Empty the array first.
              this.contextRetrievalError = error;
              this.populateConversationTurnWithDefault();
            });
  }

  private appendTextInjectionToContext() {
    // Also add the latest user entered text.
    this.contextSignals.push(...this.textInjectionContextSignals);
    // Sort context turns in asecnding order of timestamp.
    this.contextSignals.sort((turn0, turn1) => {
      // Hardcoded ones always go to the first.
      if (turn0.conversationTurn!.isHardcoded &&
          !turn1.conversationTurn!.isHardcoded) {
        return -1;
      } else if (
          !turn0.conversationTurn!.isHardcoded &&
          turn1.conversationTurn!.isHardcoded) {
        return 1;
      } else {
        return new Date(turn0.conversationTurn!.startTimestamp!).getTime() -
            new Date(turn1.conversationTurn!.startTimestamp!).getTime();
      }
    });
    this.cleanUpAndSortFocusContextIds()
  }

  private cleanUpAndSortFocusContextIds() {
    const existingContextIds =
        this.contextSignals.map(signal => signal.contextId!);
    for (let i = this.focusContextIds.length - 1; i >= 0; --i) {
      if (existingContextIds.indexOf(this.focusContextIds[i]) === -1) {
        this.focusContextIds.splice(i, 1);
      }
    }
    const contextIdsAndIndices: Array<[string, number]> = [];
    for (const contextId of this.focusContextIds) {
      contextIdsAndIndices.push(
          [contextId, existingContextIds.indexOf(contextId)]);
    }
    contextIdsAndIndices.sort((item0, item1) => {
      return item0[1] - item1[1];
    });
    this.focusContextIds.splice(0);
    this.focusContextIds.push(...contextIdsAndIndices.map(item => item[0]));
    // If still has room, add latest turn.
    if (this.contextSignals.length > 1) {
      const latestContextId =
          this.contextSignals[this.contextSignals.length - 1].contextId!;
      if (this.focusContextIds.indexOf(latestContextId) === -1) {
        this.focusContextIds.push(latestContextId);
      }
      if (this.focusContextIds.length >
          ContextComponent.MAX_FOCUS_CONTEXT_SIGNALS) {
        this.focusContextIds.splice(
            0,
            this.focusContextIds.length -
                ContextComponent.MAX_FOCUS_CONTEXT_SIGNALS);
      }
    }
  }


  private emitContextStringsSelected() {
    this.contextStringsSelected.emit(
        this.contextSignals
            .filter(
                signal =>
                    this.focusContextIds.indexOf(signal.contextId!) !== -1)
            .map(signal => signal.conversationTurn!.speechContent));
  }
}
