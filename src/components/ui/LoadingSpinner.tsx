import React from 'react';

interface LoadingSpinnerProps {
  size?: 'small' | 'medium' | 'large';
  text?: string;
}

export default function LoadingSpinner({ size = 'medium', text = '加载中...' }: LoadingSpinnerProps) {
  const sizeMap = {
    small: '16px',
    medium: '32px',
    large: '48px',
  };

  const spinnerSize = sizeMap[size];

  return (
    <div style={{ 
      display: 'flex', 
      justifyContent: 'center', 
      alignItems: 'center', 
      height: '100vh',
      backgroundColor: '#f0f2f5'
    }}>
      <div style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        gap: '16px'
      }}>
        <div 
          style={{
            width: spinnerSize,
            height: spinnerSize,
            border: '3px solid #f3f3f3',
            borderTop: '3px solid #1890ff',
            borderRadius: '50%',
            animation: 'spin 1s linear infinite'
          }}
        />
        <style jsx>{`
          @keyframes spin {
            0% { transform: rotate(0deg); }
            100% { transform: rotate(360deg); }
          }
        `}</style>
        {text && (
          <span style={{ 
            color: '#666', 
            fontSize: '14px',
            fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif'
          }}>
            {text}
          </span>
        )}
      </div>
    </div>
  );
}