
import React, { useState, useEffect } from 'react';

const TypewriterText = ({ text, delay = 50, infinite = false, onComplete }) => {
  const [currentText, setCurrentText] = useState('');
  const [currentIndex, setCurrentIndex] = useState(0);

  useEffect(() => {
    if (currentIndex < text.length) {
      const timeout = setTimeout(() => {
        setCurrentText(prevText => prevText + text[currentIndex]);
        setCurrentIndex(prevIndex => prevIndex + 1);
      }, delay);

      return () => clearTimeout(timeout);
    } else {
      if (infinite) {
        const resetTimeout = setTimeout(() => {
          setCurrentIndex(0);
          setCurrentText('');
        }, 2000);

        return () => clearTimeout(resetTimeout);
      } else if (onComplete) {
        onComplete();
      }
    }
  }, [currentIndex, delay, infinite, text, onComplete]);

  return <p>{currentText}</p>;
};

export default TypewriterText;