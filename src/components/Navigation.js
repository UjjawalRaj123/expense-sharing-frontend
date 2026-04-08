import React from 'react';
import { useAuth } from '../context/AuthContext';
import { useNavigate } from 'react-router-dom';
import { Navbar, Nav, Container, Button, Badge, Spinner } from 'react-bootstrap';
import { balanceAPI, settlementAPI } from '../api/axios';
import { FaSignOutAlt } from 'react-icons/fa';
import '../styles/Navigation.css';

const Navigation = () => {
  const { user, logout, isAuthenticated } = useAuth();
  const navigate = useNavigate();

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  const [owedAmount, setOwedAmount] = React.useState(null);
  const [settlementsCount, setSettlementsCount] = React.useState(null);
  const [metaLoading, setMetaLoading] = React.useState(false);

  React.useEffect(() => {
    const loadMeta = async () => {
      setMetaLoading(true);
      try {
        // Always fetch overall totals across all groups
        if (user && (user.id || user._id)) {
          const bres = await balanceAPI.getOverallUserBalance();
          const od = bres.data || {};
          setOwedAmount(od.totalOwes || 0);
        } else {
          setOwedAmount(null);
        }

        try {
          const sres = await settlementAPI.getMySettlements();
          const sl = sres.data.settlements || sres.data || [];
          setSettlementsCount(sl.length);
        } catch (err) {
          setSettlementsCount(null);
        }
      } catch (err) {
        console.error('Failed to load nav meta', err);
        setOwedAmount(null);
        setSettlementsCount(null);
      } finally {
        setMetaLoading(false);
      }
    };

    loadMeta();
  }, [user]);

  return (
    <Navbar expand="lg" sticky="top" className="navbar-custom" style={{
      background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
      boxShadow: '0 2px 10px rgba(0,0,0,0.1)',
      padding: '1rem 0'
    }}>
      <Container>
        <Navbar.Brand
          onClick={() => navigate('/groups')}
          style={{
            cursor: 'pointer',
            color: 'white',
            fontSize: '24px',
            fontWeight: 'bold',
            transition: 'transform 0.2s ease'
          }}
          onMouseEnter={(e) => e.currentTarget.style.transform = 'scale(1.05)'}
          onMouseLeave={(e) => e.currentTarget.style.transform = 'scale(1)'}
        >
          💰 Expense Sharing
        </Navbar.Brand>

        {isAuthenticated && (
          <>
            <Navbar.Toggle aria-controls="basic-navbar-nav" />
            <Navbar.Collapse id="basic-navbar-nav">
              <Nav className="ms-auto align-items-center">
                <Nav.Link
                  onClick={() => navigate('/groups')}
                  className="nav-link-custom me-3"
                  style={{
                    color: 'white',
                    fontWeight: '500',
                    transition: 'all 0.2s ease',
                    padding: '8px 16px',
                    borderRadius: '8px'
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.background = 'rgba(255,255,255,0.2)';
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.background = 'transparent';
                  }}
                >
                  Groups
                </Nav.Link>
                <Nav.Link
                  onClick={() => navigate('/payments')}
                  className="nav-link-custom me-3 d-flex align-items-center"
                  style={{
                    color: 'white',
                    fontWeight: '500',
                    transition: 'all 0.2s ease',
                    padding: '8px 16px',
                    borderRadius: '8px'
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.background = 'rgba(255,255,255,0.2)';
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.background = 'transparent';
                  }}
                >
                  Payments
                  {metaLoading ? (
                    <Spinner animation="border" size="sm" className="ms-2" />
                  ) : (
                    <Badge
                      bg="light"
                      text="dark"
                      className="ms-2"
                      style={{
                        padding: '4px 8px',
                        borderRadius: '6px',
                        fontWeight: '600'
                      }}
                    >
                      {owedAmount === null ? '-' : `$${parseFloat(owedAmount).toFixed(2)}`}
                    </Badge>
                  )}
                </Nav.Link>
                <Nav.Link
                  onClick={() => navigate('/settlements')}
                  className="nav-link-custom me-3 d-flex align-items-center"
                  style={{
                    color: 'white',
                    fontWeight: '500',
                    transition: 'all 0.2s ease',
                    padding: '8px 16px',
                    borderRadius: '8px'
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.background = 'rgba(255,255,255,0.2)';
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.background = 'transparent';
                  }}
                >
                  Settlements
                  <Badge
                    bg="light"
                    text="dark"
                    className="ms-2"
                    style={{
                      padding: '4px 8px',
                      borderRadius: '6px',
                      fontWeight: '600'
                    }}
                  >
                    {settlementsCount === null ? '-' : settlementsCount}
                  </Badge>
                </Nav.Link>
                <span className="text-white me-3">
                  <strong>{user?.name}</strong>
                </span>
                <Button
                  variant="danger"
                  size="sm"
                  onClick={handleLogout}
                  className="d-flex align-items-center gap-2"
                  style={{
                    background: 'linear-gradient(135deg, #ee0979 0%, #ff6a00 100%)',
                    border: 'none',
                    borderRadius: '8px',
                    padding: '8px 16px',
                    fontWeight: '600',
                    boxShadow: '0 2px 8px rgba(0,0,0,0.2)',
                    transition: 'all 0.2s ease'
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.transform = 'translateY(-2px)';
                    e.currentTarget.style.boxShadow = '0 4px 12px rgba(0,0,0,0.3)';
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.transform = 'translateY(0)';
                    e.currentTarget.style.boxShadow = '0 2px 8px rgba(0,0,0,0.2)';
                  }}
                >
                  <FaSignOutAlt /> Logout
                </Button>
              </Nav>
            </Navbar.Collapse>
          </>
        )}
      </Container>
    </Navbar>
  );
};

export default Navigation;
