'use client';

import React from 'react';
import { WeeklyGenerator } from '@/components/weekly/WeeklyGenerator';

export default function WeeklyGeneratePage() {
  return (
    <div className="flex-1 space-y-6 p-8 pt-6">
      <WeeklyGenerator />
    </div>
  );
}

