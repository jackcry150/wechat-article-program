'use server';

import {
  xhsHot,
  xhsLogin,
  xhsSearch,
  xhsStatus,
} from '../../lib/xiaohongshu';
import type { XhsCategory, XhsNoteType, XhsResult, XhsSort } from '../../lib/xiaohongshu';

export async function checkXhsStatus(): Promise<XhsResult> {
  return xhsStatus();
}

export async function loginXhs(): Promise<XhsResult> {
  return xhsLogin();
}

export async function fetchXhsHot(_prevState: XhsResult | null, formData: FormData): Promise<XhsResult> {
  return xhsHot(String(formData.get('category') || 'fashion') as XhsCategory);
}

export async function searchXhs(_prevState: XhsResult | null, formData: FormData): Promise<XhsResult> {
  return xhsSearch(
    String(formData.get('keyword') || ''),
    String(formData.get('sort') || 'general') as XhsSort,
    String(formData.get('noteType') || 'all') as XhsNoteType,
  );
}
