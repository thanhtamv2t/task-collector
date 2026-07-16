import { Injectable } from '@nestjs/common';
import { Task } from '../../database/schema';
import { ExtractedEvent } from '../ai/schemas/extracted-event.schema';
import { normalizeTaskTitle } from './task-utils';

@Injectable()
export class TaskMatcherService {
  match(event: ExtractedEvent, candidates: Task[]): Task | null {
    const reference = event.taskReference?.trim();
    if (reference) {
      const byReference = candidates.find((task) => task.id === reference || task.title.includes(reference));
      if (byReference) {
        return byReference;
      }
    }

    const title = event.title ?? event.taskReference;
    if (!title) {
      return null;
    }

    const normalizedTitle = normalizeTaskTitle(title);
    return (
      candidates.find((task) => task.normalizedTitle === normalizedTitle) ??
      candidates.find((task) => this.hasMeaningfulOverlap(task.normalizedTitle, normalizedTitle)) ??
      null
    );
  }

  private hasMeaningfulOverlap(left: string, right: string): boolean {
    const leftWords = new Set(left.split(' ').filter((word) => word.length > 2));
    const rightWords = right.split(' ').filter((word) => word.length > 2);

    if (leftWords.size === 0 || rightWords.length === 0) {
      return false;
    }

    const overlap = rightWords.filter((word) => leftWords.has(word)).length;
    return overlap / Math.max(leftWords.size, rightWords.length) >= 0.6;
  }
}
