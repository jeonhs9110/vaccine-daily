import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import Header from '../components/Header';
import Logo from '../components/Logo';
import Searchbar from '../components/Searchbar';
import UserMenu from '../components/UserMenu';
import './Issues.css';

const Issues = () => {
  const navigate = useNavigate();

  return (
    <div className="Issues">
      <Header
        leftChild={null}
        midChild={<Logo />}
        rightChild={
          <div style={{ display: 'flex', alignItems: 'center', gap: '5px', justifyContent: 'flex-end', width: 'auto' }}>
            <div style={{ position: 'relative' }}>
              <Searchbar className="always-open rounded-search" />
            </div>
            <UserMenu className="rounded-user-menu" />
          </div>
        }
        headerTop="on"
        headerMain="on"
        headerBottom="on"
      />
      <main className="Issues-Main">
        {/* Blank page content as requested */}
      </main>
    </div>
  );
};

export default Issues;
