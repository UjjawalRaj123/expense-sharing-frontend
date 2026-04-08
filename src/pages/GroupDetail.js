import React, { useState, useEffect } from 'react';
import { useParams, useNavigate, useLocation } from 'react-router-dom';
import { groupAPI, expenseAPI, balanceAPI, authAPI, settlementAPI, paymentAPI } from '../api/axios';
import { useAuth } from '../context/AuthContext';
import { Container, Row, Col, Button, Card, Form, Alert, Spinner, Nav, Tab, Badge, Modal, ListGroup } from 'react-bootstrap';
import { FaTrash, FaPlus, FaMoneyBill, FaUsers, FaExchangeAlt, FaShareAlt } from 'react-icons/fa';
import '../styles/GroupDetail.css';

const GroupDetail = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const location = useLocation();
  const [group, setGroup] = useState(null);
  const [expenses, setExpenses] = useState([]);
  const [balances, setBalances] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [activeTab, setActiveTab] = useState('expenses');
  const [showExpenseForm, setShowExpenseForm] = useState(false);
  const [showDetails, setShowDetails] = useState(false);
  const [selectedExpenseId, setSelectedExpenseId] = useState(null);
  const [expenseDetails, setExpenseDetails] = useState(null);
  const [detailsLoading, setDetailsLoading] = useState(false);
  const [detailsError, setDetailsError] = useState('');
  const [detailsSuccess, setDetailsSuccess] = useState('');
  const [groupSettlements, setGroupSettlements] = useState([]);
  const [settlementsLoading, setSettlementsLoading] = useState(false);
  const [settlementsError, setSettlementsError] = useState('');

  useEffect(() => {
    fetchGroupData();
  }, [id]);

  // Sync active tab with `tab` query param so navbar links can open Payments/Settlements
  useEffect(() => {
    const params = new URLSearchParams(location.search);
    const tab = params.get('tab');
    if (tab) setActiveTab(tab);
  }, [location.search]);

  const fetchGroupData = async () => {
    try {
      setLoading(true);
      const [groupRes, expensesRes, balancesRes] = await Promise.all([
        groupAPI.getGroupById(id),
        expenseAPI.getGroupExpenses(id),
        balanceAPI.getGroupBalances(id),
      ]);

      setGroup(groupRes.data.group);
      setExpenses(expensesRes.data.expenses);
      setBalances(balancesRes.data);
      setError('');
    } catch (err) {
      setError('Failed to fetch group data');
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteExpense = async (expenseId) => {
    if (!window.confirm('Are you sure you want to delete this expense?')) return;

    try {
      await expenseAPI.deleteExpense(expenseId);
      setExpenses(expenses.filter((e) => e._id !== expenseId));
    } catch (err) {
      setError('Failed to delete expense');
    }
  };

  const handleDeleteGroup = async () => {
    if (!window.confirm('Are you sure you want to delete this group? This action cannot be undone.')) return;

    try {
      await groupAPI.deleteGroup(id);
      navigate('/groups');
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to delete group');
    }
  };

  const handleViewDetails = async (expenseId) => {
    setSelectedExpenseId(expenseId);
    setDetailsError('');
    setExpenseDetails(null);
    setDetailsLoading(true);
    setShowDetails(true);
    setGroupSettlements([]);
    setSettlementsError('');
    setSettlementsLoading(true);

    try {
      const res = await expenseAPI.getExpenseById(expenseId);
      const data = res.data.expense || res.data;
      setExpenseDetails(data);
      // fetch group settlements for this group
      try {
        const sres = await settlementAPI.getGroupSettlements(id);
        const sdata = sres.data.settlements || sres.data;
        setGroupSettlements(sdata);
      } catch (serr) {
        console.error('Failed to fetch settlements', serr);
        setSettlementsError('Failed to load recorded settlements');
      }
    } catch (err) {
      console.error(err);
      setDetailsError('Failed to load expense details');
    } finally {
      setDetailsLoading(false);
      setSettlementsLoading(false);
    }
  };


  // check for payment success query and confirm
  useEffect(() => {
    const params = new URLSearchParams(location.search);
    const success = params.get('payment_success');
    const sessionId = params.get('session_id');
    if (success === '1' && sessionId) {
      // confirm with backend and then refresh
      (async () => {
        try {
          setDetailsLoading(true);
          await paymentAPI.confirmPayment(sessionId);
          // refresh data
          fetchGroupData();
          // clear query params
          params.delete('payment_success');
          params.delete('session_id');
          const newUrl = window.location.pathname + (params.toString() ? '?' + params.toString() : '');
          window.history.replaceState({}, document.title, newUrl);
        } catch (err) {
          console.error('Payment confirm failed', err);
        } finally {
          setDetailsLoading(false);
        }
      })();
    }
  }, [location.search, id]);

  const handleDeleteSettlement = async (settlementId) => {
    if (!window.confirm('Delete this recorded payment?')) return;
    try {
      await settlementAPI.deleteSettlement(settlementId);
      // refresh modal list
      setGroupSettlements(prev => prev.filter(s => s._id !== settlementId));
    } catch (err) {
      console.error(err);
      setSettlementsError(err.response?.data?.message || 'Failed to delete settlement');
    }
  };

  const closeExpenseDetails = () => {
    setShowDetails(false);
    setSelectedExpenseId(null);
    setExpenseDetails(null);
    setDetailsError('');
  };

  const copyPaymentInstructions = async () => {
    if (!expenseDetails) return;
    const payeeName = expenseDetails.paidBy?.name || 'Payee';
    const payeeEmail = expenseDetails.paidBy?.email || '';
    const lines = [];
    lines.push(`Expense: ${expenseDetails.description}`);
    lines.push(`Total: $${expenseDetails.amount.toFixed(2)}`);
    lines.push(`Please pay ${payeeName}${payeeEmail ? ` (${payeeEmail})` : ''}`);
    lines.push('Shares:');
    (expenseDetails.splits || []).forEach(s => {
      const name = s.user?.name || s.user;
      lines.push(`- ${name}: $${s.amount.toFixed(2)}`);
    });

    const text = lines.join('\n');
    try {
      await navigator.clipboard.writeText(text);
      setDetailsSuccess('Payment instructions copied to clipboard');
      setTimeout(() => setDetailsSuccess(''), 3000);
    } catch (err) {
      console.error('Clipboard error', err);
      setDetailsError('Failed to copy instructions');
    }
  };

  const recordPayment = async (toUserId, amount) => {
    // current user records that they paid `toUserId` amount
    try {
      await settlementAPI.createSettlement(group._id, toUserId, amount, `Payment for expense ${selectedExpenseId}`);
      setDetailsSuccess('Payment recorded');
      // optionally refresh balances
      fetchGroupData();
      setTimeout(() => setDetailsSuccess(''), 3000);
    } catch (err) {
      console.error(err);
      setDetailsError(err.response?.data?.message || 'Failed to record payment');
    }
  };

  if (loading) return (
    <Container className="text-center py-5">
      <Spinner animation="border" variant="primary" />
      <p className="mt-3">Loading group...</p>
    </Container>
  );

  if (!group) return (
    <Container className="py-5">
      <Alert variant="danger">Group not found</Alert>
    </Container>
  );

  return (
    <Container className="py-5">
      {/* Header */}
      <Row className="mb-5">
        <Col md={8}>
          <h1 className="fw-bold mb-2" style={{
            background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
            WebkitBackgroundClip: 'text',
            WebkitTextFillColor: 'transparent',
            backgroundClip: 'text',
            fontSize: '2.5rem'
          }}>
            {group.name}
          </h1>
          <p className="text-secondary fs-5">{group.description}</p>
        </Col>
        <Col md={4} className="text-end">
          <Button
            variant="danger"
            size="lg"
            onClick={handleDeleteGroup}
            className="d-flex align-items-center gap-2 ms-auto"
            style={{
              background: 'linear-gradient(135deg, #ee0979 0%, #ff6a00 100%)',
              border: 'none',
              borderRadius: '10px',
              padding: '12px 24px',
              fontWeight: '600',
              boxShadow: '0 4px 15px rgba(0,0,0,0.2)',
              transition: 'all 0.3s ease'
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.transform = 'translateY(-2px)';
              e.currentTarget.style.boxShadow = '0 6px 20px rgba(0,0,0,0.3)';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.transform = 'translateY(0)';
              e.currentTarget.style.boxShadow = '0 4px 15px rgba(0,0,0,0.2)';
            }}
          >
            <FaTrash /> Delete Group
          </Button>
        </Col>
      </Row>

      {error && <Alert variant="danger" className="mb-4">{error}</Alert>}

      {/* Tabs */}
      <Tab.Container activeKey={activeTab} onSelect={(k) => setActiveTab(k)}>
        <Nav variant="tabs" className="mb-4" style={{
          borderBottom: '2px solid #e0e0e0',
          gap: '0.5rem'
        }}>
          <Nav.Item>
            <Nav.Link
              eventKey="expenses"
              className="fw-bold"
              style={{
                border: 'none',
                borderRadius: '10px 10px 0 0',
                padding: '12px 24px',
                transition: 'all 0.2s ease',
                background: activeTab === 'expenses'
                  ? 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)'
                  : 'transparent',
                color: activeTab === 'expenses' ? 'white' : '#667eea',
                fontWeight: '600'
              }}
              onMouseEnter={(e) => {
                if (activeTab !== 'expenses') {
                  e.currentTarget.style.background = 'rgba(102, 126, 234, 0.1)';
                }
              }}
              onMouseLeave={(e) => {
                if (activeTab !== 'expenses') {
                  e.currentTarget.style.background = 'transparent';
                }
              }}
            >
              <FaMoneyBill className="me-2" /> Expenses
            </Nav.Link>
          </Nav.Item>
          <Nav.Item>
            <Nav.Link
              eventKey="balances"
              className="fw-bold"
              style={{
                border: 'none',
                borderRadius: '10px 10px 0 0',
                padding: '12px 24px',
                transition: 'all 0.2s ease',
                background: activeTab === 'balances'
                  ? 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)'
                  : 'transparent',
                color: activeTab === 'balances' ? 'white' : '#667eea',
                fontWeight: '600'
              }}
              onMouseEnter={(e) => {
                if (activeTab !== 'balances') {
                  e.currentTarget.style.background = 'rgba(102, 126, 234, 0.1)';
                }
              }}
              onMouseLeave={(e) => {
                if (activeTab !== 'balances') {
                  e.currentTarget.style.background = 'transparent';
                }
              }}
            >
              <FaExchangeAlt className="me-2" /> Balances
            </Nav.Link>
          </Nav.Item>
          <Nav.Item>
            <Nav.Link
              eventKey="payments"
              className="fw-bold"
              style={{
                border: 'none',
                borderRadius: '10px 10px 0 0',
                padding: '12px 24px',
                transition: 'all 0.2s ease',
                background: activeTab === 'payments'
                  ? 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)'
                  : 'transparent',
                color: activeTab === 'payments' ? 'white' : '#667eea',
                fontWeight: '600'
              }}
              onMouseEnter={(e) => {
                if (activeTab !== 'payments') {
                  e.currentTarget.style.background = 'rgba(102, 126, 234, 0.1)';
                }
              }}
              onMouseLeave={(e) => {
                if (activeTab !== 'payments') {
                  e.currentTarget.style.background = 'transparent';
                }
              }}
            >
              <FaMoneyBill className="me-2" /> Payments
            </Nav.Link>
          </Nav.Item>
          <Nav.Item>
            <Nav.Link
              eventKey="settlements"
              className="fw-bold"
              style={{
                border: 'none',
                borderRadius: '10px 10px 0 0',
                padding: '12px 24px',
                transition: 'all 0.2s ease',
                background: activeTab === 'settlements'
                  ? 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)'
                  : 'transparent',
                color: activeTab === 'settlements' ? 'white' : '#667eea',
                fontWeight: '600'
              }}
              onMouseEnter={(e) => {
                if (activeTab !== 'settlements') {
                  e.currentTarget.style.background = 'rgba(102, 126, 234, 0.1)';
                }
              }}
              onMouseLeave={(e) => {
                if (activeTab !== 'settlements') {
                  e.currentTarget.style.background = 'transparent';
                }
              }}
            >
              <FaExchangeAlt className="me-2" /> Settlements
            </Nav.Link>
          </Nav.Item>
          <Nav.Item>
            <Nav.Link
              eventKey="members"
              className="fw-bold"
              style={{
                border: 'none',
                borderRadius: '10px 10px 0 0',
                padding: '12px 24px',
                transition: 'all 0.2s ease',
                background: activeTab === 'members'
                  ? 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)'
                  : 'transparent',
                color: activeTab === 'members' ? 'white' : '#667eea',
                fontWeight: '600'
              }}
              onMouseEnter={(e) => {
                if (activeTab !== 'members') {
                  e.currentTarget.style.background = 'rgba(102, 126, 234, 0.1)';
                }
              }}
              onMouseLeave={(e) => {
                if (activeTab !== 'members') {
                  e.currentTarget.style.background = 'transparent';
                }
              }}
            >
              <FaUsers className="me-2" /> Members ({group.members.length})
            </Nav.Link>
          </Nav.Item>
        </Nav>

        <Tab.Content>
          {/* Expenses Tab */}
          <Tab.Pane eventKey="expenses">
            <Row className="mb-4">
              <Col>
                <Button
                  variant={showExpenseForm ? 'danger' : 'success'}
                  size="lg"
                  onClick={() => setShowExpenseForm(!showExpenseForm)}
                  className="d-flex align-items-center gap-2"
                  style={{
                    background: showExpenseForm
                      ? 'linear-gradient(135deg, #ee0979 0%, #ff6a00 100%)'
                      : 'linear-gradient(135deg, #11998e 0%, #38ef7d 100%)',
                    border: 'none',
                    borderRadius: '10px',
                    padding: '12px 24px',
                    fontWeight: '600',
                    boxShadow: '0 4px 15px rgba(0,0,0,0.2)',
                    transition: 'all 0.3s ease'
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.transform = 'translateY(-2px)';
                    e.currentTarget.style.boxShadow = '0 6px 20px rgba(0,0,0,0.3)';
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.transform = 'translateY(0)';
                    e.currentTarget.style.boxShadow = '0 4px 15px rgba(0,0,0,0.2)';
                  }}
                >
                  <FaPlus /> {showExpenseForm ? 'Cancel' : 'Add Expense'}
                </Button>
              </Col>
            </Row>

            {showExpenseForm && (
              <Card className="mb-4 shadow-sm">
                <Card.Header className="bg-light">
                  <h5 className="mb-0">Add New Expense</h5>
                </Card.Header>
                <Card.Body>
                  <ExpenseForm
                    groupId={id}
                    groupMembers={group.members}
                    onExpenseAdded={() => {
                      setShowExpenseForm(false);
                      fetchGroupData();
                    }}
                  />
                </Card.Body>
              </Card>
            )}

            {expenses.length === 0 ? (
              <Alert variant="info" className="text-center">
                No expenses yet. Add one to get started!
              </Alert>
            ) : (
              <Row className="g-4">
                {expenses.map((expense) => (
                  <Col lg={6} key={expense._id}>
                    <Card className="h-100 shadow-sm expense-card">
                      <Card.Body>
                        <div className="d-flex justify-content-between align-items-start mb-3">
                          <div>
                            <Card.Title className="mb-0">{expense.description}</Card.Title>
                            <small className="text-muted">{expense.category}</small>
                          </div>
                          <Badge bg="primary" className="fs-6">
                            ${expense.amount.toFixed(2)}
                          </Badge>
                        </div>

                        <div className="mb-3">
                          <p className="mb-2">
                            <strong>Paid by:</strong> {expense.paidBy.name}
                          </p>
                          <p className="mb-2">
                            <strong>Split Type:</strong>{' '}
                            <Badge bg="secondary">{expense.splitType}</Badge>
                          </p>
                          {expense.notes && (
                            <p className="mb-2 text-muted">
                              <strong>Notes:</strong> {expense.notes}
                            </p>
                          )}
                        </div>

                        <div className="d-flex gap-2">
                          <Button
                            variant="primary"
                            size="sm"
                            onClick={() => handleViewDetails(expense._id)}
                            className="d-flex align-items-center gap-2"
                          >
                            View Details
                          </Button>

                          <Button
                            variant="outline-danger"
                            size="sm"
                            onClick={() => handleDeleteExpense(expense._id)}
                            className="d-flex align-items-center gap-2"
                          >
                            <FaTrash /> Delete
                          </Button>
                        </div>
                      </Card.Body>
                    </Card>
                  </Col>
                ))}
              </Row>
            )}
          </Tab.Pane>

          {/* Balances Tab */}
          <Tab.Pane eventKey="balances">
            {balances && <BalanceSummary balances={balances} />}
          </Tab.Pane>

          {/* Settlements Tab (current group only) */}
          <Tab.Pane eventKey="settlements">
            <AllGroupsSettlementsTab groupId={id} />
          </Tab.Pane>

          {/* Payments Tab (current group only) */}
          <Tab.Pane eventKey="payments">
            <AllGroupsPaymentsTab groupId={id} />
          </Tab.Pane>

          {/* Members Tab */}
          <Tab.Pane eventKey="members">
            <AddMembersSection
              groupId={id}
              groupMembers={group.members}
              groupCreatorId={group.createdBy._id}
              onMemberAdded={fetchGroupData}
            />

            <h5 className="mt-5 mb-4 text-primary fw-bold">Current Members ({group.members.length})</h5>
            <Row className="g-4">
              {group.members.map((member) => (
                <Col lg={4} md={6} key={member._id}>
                  <Card className="h-100 shadow-sm">
                    <Card.Body>
                      <Card.Title className="text-primary">{member.name}</Card.Title>
                      <p className="text-muted mb-2">{member.email}</p>
                      {group.createdBy._id === member._id && (
                        <Badge bg="success">Creator</Badge>
                      )}
                    </Card.Body>
                  </Card>
                </Col>
              ))}
            </Row>
          </Tab.Pane>
        </Tab.Content>
      </Tab.Container>

      {/* Expense Details Modal */}
      <Modal show={showDetails} onHide={closeExpenseDetails} size="lg">
        <Modal.Header closeButton>
          <Modal.Title>Expense Details</Modal.Title>
        </Modal.Header>
        <Modal.Body>
          {detailsLoading ? (
            <div className="text-center py-4">
              <Spinner animation="border" />
            </div>
          ) : detailsError ? (
            <Alert variant="danger">{detailsError}</Alert>
          ) : expenseDetails ? (
            <div>
              {detailsSuccess && <Alert variant="success">{detailsSuccess}</Alert>}
              <div className="d-flex justify-content-end mb-2">
                {(expenseDetails.splits && expenseDetails.splits.length > 0) && (
                  <Button variant="outline-primary" size="sm" onClick={copyPaymentInstructions} className="me-2">Copy Payment Instructions</Button>
                )}
              </div>
              <h5 className="mb-2">{expenseDetails.description}</h5>
              <p className="text-muted mb-2">Category: {expenseDetails.category}</p>
              <p className="mb-2">
                <strong>Amount:</strong> ${expenseDetails.amount.toFixed(2)}
              </p>
              <p className="mb-2">
                <strong>Paid by:</strong> {expenseDetails.paidBy?.name || expenseDetails.paidBy}
              </p>
              <p className="mb-2 text-muted"><strong>Split Type:</strong> {expenseDetails.splitType}</p>
              {expenseDetails.notes && (
                <p className="mb-2"><strong>Notes:</strong> {expenseDetails.notes}</p>
              )}

              <hr />
              <h6>Splits</h6>
              <ListGroup variant="flush">
                {expenseDetails.splits && expenseDetails.splits.map((s, idx) => {
                  const userId = s.user?._id || s.user;
                  const paidById = expenseDetails.paidBy?._id || expenseDetails.paidBy;

                  // Check if this user is the one who paid for the expense
                  const userPaidExpense = userId === paidById;

                  // Check if this user has paid via settlement (only if they didn't pay originally)
                  const userHasPaid = !userPaidExpense && groupSettlements.some(settlement =>
                    (settlement.from?._id === userId || settlement.from === userId) &&
                    (settlement.to?._id === paidById || settlement.to === paidById) &&
                    settlement.amount >= s.amount
                  );

                  // Green if user paid the expense OR has settled via payment
                  // Red if user hasn't paid
                  const isPaid = userPaidExpense || userHasPaid;

                  return (
                    <ListGroup.Item key={idx} className="d-flex justify-content-between align-items-center">
                      <div>
                        <div>{s.user?.name || s.user}</div>
                        {s.user?.email && <small className="text-muted">{s.user.email}</small>}
                      </div>
                      <div className="d-flex align-items-center gap-2">
                        <Badge bg={isPaid ? "success" : "danger"}>
                          ${s.amount.toFixed(2)}
                        </Badge>
                      </div>
                    </ListGroup.Item>
                  );
                })}
              </ListGroup>

              <div className="mt-3 text-end text-muted">Created: {new Date(expenseDetails.createdAt).toLocaleString()}</div>

              <hr />
              <h6>Recorded Settlements</h6>
              {settlementsLoading ? (
                <div className="text-center py-2"><Spinner animation="border" size="sm" /></div>
              ) : settlementsError ? (
                <Alert variant="warning">{settlementsError}</Alert>
              ) : groupSettlements && groupSettlements.length === 0 ? (
                <div className="text-muted">No payments recorded yet for this group.</div>
              ) : (
                <ListGroup className="mt-2">
                  {groupSettlements.map((s) => (
                    <ListGroup.Item key={s._id} className="d-flex justify-content-between align-items-center">
                      <div>
                        <div><strong>{s.from?.name}</strong> → <strong>{s.to?.name}</strong></div>
                        {s.note && <small className="text-muted">{s.note}</small>}
                      </div>
                      <div className="text-end">
                        <div className="fw-bold">${s.amount.toFixed(2)}</div>
                        <small className="text-muted">{new Date(s.createdAt).toLocaleString()}</small>
                      </div>
                    </ListGroup.Item>
                  ))}
                </ListGroup>
              )}
            </div>
          ) : (
            <div>No details available</div>
          )}
        </Modal.Body>
        <Modal.Footer>
          <Button variant="secondary" onClick={closeExpenseDetails}>Close</Button>
        </Modal.Footer>
      </Modal>

    </Container>
  );
};

const ExpenseForm = ({ groupId, groupMembers, onExpenseAdded }) => {
  const [formData, setFormData] = useState({
    description: '',
    amount: '',
    splitType: 'equal',
    category: 'General',
    notes: '',
  });
  const [exactAmounts, setExactAmounts] = useState({});
  const [percentages, setPercentages] = useState({});
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  // Initialize exact amounts and percentages when component mounts or groupMembers changes
  React.useEffect(() => {
    if (groupMembers && groupMembers.length > 0) {
      const initialExact = {};
      const initialPercent = {};
      groupMembers.forEach(member => {
        initialExact[member._id] = '';
        initialPercent[member._id] = (100 / groupMembers.length).toFixed(2);
      });
      setExactAmounts(initialExact);
      setPercentages(initialPercent);
    }
  }, [groupMembers]);

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!formData.description.trim() || !formData.amount) {
      setError('Description and amount are required');
      return;
    }

    if (!groupMembers || groupMembers.length === 0) {
      setError('No group members found');
      return;
    }

    const amount = parseFloat(formData.amount);
    setLoading(true);

    try {
      let splits = [];
      let percentagesData = [];

      if (formData.splitType === 'equal') {
        // For equal split, distribute equally among all members
        const equalAmount = parseFloat((amount / groupMembers.length).toFixed(2));
        splits = groupMembers.map(member => ({
          user: member._id,
          amount: equalAmount,
        }));
      } else if (formData.splitType === 'exact') {
        // For exact split, use entered amounts
        const hasEmptyAmount = groupMembers.some(member => !exactAmounts[member._id]);
        if (hasEmptyAmount) {
          setError('Please enter exact amount for all members');
          setLoading(false);
          return;
        }

        splits = groupMembers.map(member => ({
          user: member._id,
          amount: parseFloat(exactAmounts[member._id]),
        }));

        // Validate total matches
        const total = splits.reduce((sum, split) => sum + split.amount, 0);
        if (Math.abs(total - amount) > 0.01) {
          setError(`Exact amounts must sum to ${amount.toFixed(2)}, but sum is ${total.toFixed(2)}`);
          setLoading(false);
          return;
        }
      } else if (formData.splitType === 'percentage') {
        // For percentage split, use entered percentages
        percentagesData = groupMembers.map(member => ({
          user: member._id,
          percentage: parseFloat(percentages[member._id]),
        }));

        // Validate percentages sum to 100
        const totalPercent = percentagesData.reduce((sum, p) => sum + p.percentage, 0);
        if (Math.abs(totalPercent - 100) > 0.01) {
          setError(`Percentages must sum to 100, but sum is ${totalPercent.toFixed(2)}`);
          setLoading(false);
          return;
        }
      }

      await expenseAPI.createExpense(
        formData.description,
        amount,
        groupId,
        formData.splitType,
        splits,
        percentagesData,
        formData.category,
        formData.notes
      );

      // Reset form
      setFormData({
        description: '',
        amount: '',
        splitType: 'equal',
        category: 'General',
        notes: '',
      });
      setError('');
      onExpenseAdded();
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to create expense');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Form onSubmit={handleSubmit}>
      {error && <Alert variant="danger" className="mb-3">{error}</Alert>}

      <Form.Group className="mb-3">
        <Form.Label className="fw-bold">Description</Form.Label>
        <Form.Control
          type="text"
          placeholder="What was this expense for?"
          value={formData.description}
          onChange={(e) => setFormData({ ...formData, description: e.target.value })}
          required
        />
      </Form.Group>

      <Form.Group className="mb-3">
        <Form.Label className="fw-bold">Amount</Form.Label>
        <Form.Control
          type="number"
          step="0.01"
          placeholder="0.00"
          value={formData.amount}
          onChange={(e) => setFormData({ ...formData, amount: e.target.value })}
          required
        />
      </Form.Group>

      <Row>
        <Col md={6}>
          <Form.Group className="mb-3">
            <Form.Label className="fw-bold">Split Type</Form.Label>
            <Form.Select
              value={formData.splitType}
              onChange={(e) => setFormData({ ...formData, splitType: e.target.value })}
            >
              <option value="equal">Equal Split</option>
              <option value="exact">Exact Amount</option>
              <option value="percentage">Percentage</option>
            </Form.Select>
          </Form.Group>
        </Col>
        <Col md={6}>
          <Form.Group className="mb-3">
            <Form.Label className="fw-bold">Category</Form.Label>
            <Form.Control
              type="text"
              placeholder="e.g., Food, Transport"
              value={formData.category}
              onChange={(e) => setFormData({ ...formData, category: e.target.value })}
            />
          </Form.Group>
        </Col>
      </Row>

      {/* Exact Amount Split Fields */}
      {formData.splitType === 'exact' && (
        <div className="mb-4 p-3 border rounded bg-light">
          <h6 className="mb-3 fw-bold">Enter Amount for Each Member</h6>
          <Row className="g-2">
            {groupMembers && groupMembers.map(member => (
              <Col lg={6} key={member._id}>
                <Form.Group>
                  <Form.Label className="small">{member.name}</Form.Label>
                  <Form.Control
                    type="number"
                    step="0.01"
                    placeholder="0.00"
                    value={exactAmounts[member._id] || ''}
                    onChange={(e) => setExactAmounts({
                      ...exactAmounts,
                      [member._id]: e.target.value
                    })}
                  />
                </Form.Group>
              </Col>
            ))}
          </Row>
        </div>
      )}

      {/* Percentage Split Fields */}
      {formData.splitType === 'percentage' && (
        <div className="mb-4 p-3 border rounded bg-light">
          <h6 className="mb-3 fw-bold">Enter Percentage for Each Member</h6>
          <Row className="g-2">
            {groupMembers && groupMembers.map(member => (
              <Col lg={6} key={member._id}>
                <Form.Group>
                  <Form.Label className="small">{member.name}</Form.Label>
                  <div className="input-group input-group-sm">
                    <Form.Control
                      type="number"
                      step="0.01"
                      placeholder="0"
                      value={percentages[member._id] || ''}
                      onChange={(e) => setPercentages({
                        ...percentages,
                        [member._id]: e.target.value
                      })}
                    />
                    <span className="input-group-text">%</span>
                  </div>
                </Form.Group>
              </Col>
            ))}
          </Row>
          <small className="text-muted d-block mt-2">Total must equal 100%</small>
        </div>
      )}

      <Form.Group className="mb-4">
        <Form.Label className="fw-bold">Notes</Form.Label>
        <Form.Control
          as="textarea"
          rows={3}
          placeholder="Any additional notes..."
          value={formData.notes}
          onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
        />
      </Form.Group>

      <Button
        variant="primary"
        type="submit"
        disabled={loading}
        size="lg"
        className="w-100"
      >
        {loading ? 'Adding Expense...' : 'Add Expense'}
      </Button>
    </Form>
  );
};

const BalanceSummary = ({ balances }) => {
  return (
    <div>
      {/* User Summary Card */}
      <Row className="mb-4">
        <Col md={12}>
          <Card className="shadow-sm balance-summary-card">
            <Card.Body>
              <h5 className="card-title mb-4 text-primary fw-bold">Your Balance Summary</h5>
              <Row>
                <Col md={4} className="text-center">
                  <div className="mb-3">
                    <h6 className="text-muted">You Owe</h6>
                    <h3 className="text-danger fw-bold">
                      ${balances.userSummary.totalOwes.toFixed(2)}
                    </h3>
                  </div>
                </Col>
                <Col md={4} className="text-center">
                  <div className="mb-3">
                    <h6 className="text-muted">Owed to You</h6>
                    <h3 className="text-success fw-bold">
                      ${balances.userSummary.totalIsOwed.toFixed(2)}
                    </h3>
                  </div>
                </Col>
                <Col md={4} className="text-center">
                  <div className="mb-3">
                    <h6 className="text-muted">Net Balance</h6>
                    <h3 className={`fw-bold ${balances.userSummary.netBalance >= 0 ? 'text-success' : 'text-danger'}`}>
                      ${balances.userSummary.netBalance.toFixed(2)}
                    </h3>
                  </div>
                </Col>
              </Row>
            </Card.Body>
          </Card>
        </Col>
      </Row>

      {/* All Balances */}
      <h5 className="mb-3 text-primary fw-bold">All Member Balances</h5>
      <Row className="g-4">
        {balances.balances.map((balance) => (
          <Col lg={4} md={6} key={balance.userId}>
            <Card className="h-100 shadow-sm member-balance-card">
              <Card.Body>
                <Card.Title className="text-primary mb-2">{balance.userName}</Card.Title>
                <p className="text-muted small mb-3">{balance.userEmail}</p>

                <div className="mb-3">
                  <div className="d-flex justify-content-between mb-2">
                    <span className="fw-bold">Total Spent:</span>
                    <Badge bg="info">${balance.totalSpent.toFixed(2)}</Badge>
                  </div>
                  <div className="d-flex justify-content-between">
                    <span className="fw-bold">Total Owed:</span>
                    <Badge bg="warning">${balance.totalOwed.toFixed(2)}</Badge>
                  </div>
                </div>

                {balance.owedBy.length > 0 && (
                  <div className="border-top pt-3">
                    <small className="fw-bold text-secondary mb-2 d-block">Owed by:</small>
                    {balance.owedBy.map((debt) => (
                      <div key={debt.userId} className="mb-2">
                        <small>
                          {debt.userName}:{' '}
                          <Badge bg="danger">${debt.amount.toFixed(2)}</Badge>
                        </small>
                      </div>
                    ))}
                  </div>
                )}
              </Card.Body>
            </Card>
          </Col>
        ))}
      </Row>
    </div>
  );
};

const PaymentsTab = ({ groupId, groupMembers = [], onPaid }) => {
  const { user: currentUser } = useAuth();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [userBalance, setUserBalance] = useState(null);

  useEffect(() => {
    loadUserBalance();
  }, [groupId, currentUser]);

  const loadUserBalance = async () => {
    const currentUserId = currentUser.id || currentUser._id;
    if (!currentUser || !currentUserId) return;
    setLoading(true);
    setError('');
    try {
      const res = await balanceAPI.getUserBalance(groupId, currentUserId);
      setUserBalance(res.data);
    } catch (err) {
      console.error(err);
      setError('Failed to load your balance');
    } finally {
      setLoading(false);
    }
  };

  const handlePay = async (toUserId, amount) => {
    try {
      setLoading(true);
      const res = await paymentAPI.createCheckoutSession(groupId, toUserId, amount);
      const url = res.data.url || res.data.sessionUrl;
      if (url) {
        // redirect to Stripe Checkout
        window.location.href = url;
      } else {
        setError('Failed to start payment session');
      }
    } catch (err) {
      console.error(err);
      setError(err.response?.data?.message || 'Payment start failed');
    } finally {
      setLoading(false);
    }
  };

  const sharePaymentRequest = async (toUserId, amount) => {
    const member = groupMembers.find(m => m._id === toUserId || m._id === (toUserId?.toString && toUserId.toString()));
    const name = member ? member.name : toUserId;
    const email = member ? member.email : '';
    const text = `Please pay ${name} ${email ? `(${email}) ` : ''}an amount of $${parseFloat(amount).toFixed(2)} for group ${groupId}.`;

    try {
      if (navigator.share) {
        await navigator.share({ title: 'Payment Request', text });
      } else {
        await navigator.clipboard.writeText(text);
        alert('Payment request copied to clipboard.');
      }
    } catch (err) {
      console.error('Share failed', err);
      try { await navigator.clipboard.writeText(text); alert('Payment request copied to clipboard.'); } catch (_) { setError('Failed to share or copy payment request'); }
    }
  };

  if (loading) return <div className="text-center py-3"><Spinner animation="border" /></div>;
  if (error) return <Alert variant="danger">{error}</Alert>;
  if (!userBalance || !userBalance.owedBy) return <div className="text-muted">No outstanding payments.</div>;

  const creditors = Object.entries(userBalance.owedBy).map(([creditorId, amt]) => ({ creditorId, amount: amt }));

  return (
    <div>
      {creditors.length === 0 ? (
        <Alert variant="info">You have no payments to make.</Alert>
      ) : (
        <ListGroup>
          {creditors.map((c) => {
            const member = groupMembers.find(m => (m._id === c.creditorId) || (m._id === (c.creditorId?.toString && c.creditorId.toString())));
            const name = member ? member.name : c.creditorId;
            const email = member ? member.email : null;
            const initials = name ? name.split(' ').map(n => n[0]).slice(0, 2).join('').toUpperCase() : '?';
            return (
              <ListGroup.Item key={c.creditorId} className="d-flex justify-content-between align-items-center">
                <div className="d-flex align-items-center gap-3">
                  <div style={{ width: 40, height: 40, borderRadius: 20, background: '#6c757d', color: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: '700' }}>{initials}</div>
                  <div>
                    <div><strong>To:</strong> {name}</div>
                    {email && <small className="text-muted">{email}</small>}
                  </div>
                </div>
                <div className="text-end">
                  <div className="fw-bold">${parseFloat(c.amount).toFixed(2)}</div>
                  <div className="mt-2 d-flex gap-2 justify-content-end">
                    <Button size="sm" variant="outline-secondary" onClick={() => sharePaymentRequest(c.creditorId, c.amount)} title="Share request"><FaShareAlt /></Button>
                    <Button size="sm" variant="primary" onClick={() => handlePay(c.creditorId, c.amount)}>Pay</Button>
                  </div>
                </div>
              </ListGroup.Item>
            );
          })}
        </ListGroup>
      )}
    </div>
  );
};

const AddMembersSection = ({ groupId, groupMembers, groupCreatorId, onMemberAdded }) => {
  const [allUsers, setAllUsers] = useState([]);
  const [selectedUserId, setSelectedUserId] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [showForm, setShowForm] = useState(false);
  const { user: currentUser } = useAuth();

  // Check if current user is the group creator
  const isCreator = currentUser && (currentUser.id || currentUser._id) === groupCreatorId;

  useEffect(() => {
    if (showForm) {
      fetchAllUsers();
    }
  }, [showForm]);

  const fetchAllUsers = async () => {
    try {
      const res = await authAPI.getAllUsers();
      setAllUsers(res.data.users);
    } catch (err) {
      setError('Failed to fetch users');
    }
  };

  // Filter out already added members
  const availableUsers = allUsers.filter(
    user => !groupMembers.find(member => member._id === user._id)
  );

  const handleAddMember = async (e) => {
    e.preventDefault();

    if (!selectedUserId) {
      setError('Please select a user');
      return;
    }

    setLoading(true);
    try {
      await groupAPI.addMemberToGroup(groupId, selectedUserId);
      setSuccess('Member added successfully!');
      setSelectedUserId('');
      setShowForm(false);
      onMemberAdded();
      setTimeout(() => setSuccess(''), 3000);
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to add member');
    } finally {
      setLoading(false);
    }
  };

  if (!isCreator) {
    return (
      <Alert variant="info">
        <FaUsers className="me-2" />
        Only the group creator can add members.
      </Alert>
    );
  }

  return (
    <Card className="mb-4 shadow-sm">
      <Card.Header className="bg-light d-flex justify-content-between align-items-center">
        <h5 className="mb-0">Add Members to Group</h5>
        <Button
          variant={showForm ? 'danger' : 'primary'}
          size="sm"
          onClick={() => {
            setShowForm(!showForm);
            setError('');
            setSuccess('');
          }}
        >
          {showForm ? 'Cancel' : 'Add Member'}
        </Button>
      </Card.Header>

      {showForm && (
        <Card.Body>
          {error && <Alert variant="danger" className="mb-3">{error}</Alert>}
          {success && <Alert variant="success" className="mb-3">{success}</Alert>}

          {availableUsers.length === 0 ? (
            <Alert variant="info">
              All available users are already members of this group.
            </Alert>
          ) : (
            <Form onSubmit={handleAddMember}>
              <Form.Group className="mb-3">
                <Form.Label className="fw-bold">Select User to Add</Form.Label>
                <Form.Select
                  value={selectedUserId}
                  onChange={(e) => setSelectedUserId(e.target.value)}
                  required
                  disabled={loading}
                >
                  <option value="">-- Choose a user --</option>
                  {availableUsers.map(user => (
                    <option key={user._id} value={user._id}>
                      {user.name} ({user.email})
                    </option>
                  ))}
                </Form.Select>
              </Form.Group>

              <Button
                variant="success"
                type="submit"
                disabled={loading || !selectedUserId}
                className="d-flex align-items-center gap-2"
              >
                <FaPlus /> {loading ? 'Adding...' : 'Add Member'}
              </Button>
            </Form>
          )}
        </Card.Body>
      )}
    </Card>
  );
};

// AllGroupsPaymentsTab - Shows payments for a specific group or all groups
const AllGroupsPaymentsTab = ({ groupId = null }) => {
  const { user: currentUser } = useAuth();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [allPayments, setAllPayments] = useState([]);

  useEffect(() => {
    if (currentUser?.id || currentUser?._id) {
      fetchAllGroupsPayments();
    } else {
      setLoading(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentUser, groupId]);

  const fetchAllGroupsPayments = async () => {
    if (!currentUser || !(currentUser.id || currentUser._id)) return;

    setLoading(true);
    setError('');

    try {
      let expenses = [];
      let settlements = [];

      if (groupId) {
        // Fetch data for the specific group
        const [expensesRes, settlementsRes] = await Promise.all([
          expenseAPI.getGroupExpenses(groupId),
          settlementAPI.getGroupSettlements(groupId)
        ]);
        expenses = expensesRes.data.expenses || [];
        settlements = settlementsRes.data.settlements || [];
      } else {
        // Fetch all user data across groups
        const [expensesRes, settlementsRes] = await Promise.all([
          expenseAPI.getMyExpenses(),
          settlementAPI.getMySettlements()
        ]);
        expenses = expensesRes.data.expenses || [];
        settlements = settlementsRes.data.settlements || [];
      }

      // Extract unpaid expenses where current user owes money
      const unpaidExpenses = [];
      expenses.forEach(expense => {
        // Find current user's split
        const currentUserId = currentUser.id || currentUser._id;
        const userSplit = expense.splits?.find(s =>
          (s.user?._id === currentUserId || s.user === currentUserId)
        );

        if (!userSplit) return; // User not part of this expense

        // Check if user is the one who paid
        const userPaid = (expense.paidBy?._id === currentUserId || expense.paidBy === currentUserId);
        if (userPaid) return; // User paid, so they don't owe

        // Check if user has settled this expense
        const paidById = expense.paidBy?._id || expense.paidBy;
        const userHasPaid = settlements.some(settlement =>
          (settlement.from?._id === currentUserId || settlement.from === currentUserId) &&
          (settlement.to?._id === paidById || settlement.to === paidById) &&
          settlement.amount >= userSplit.amount
        );

        if (userHasPaid) return; // Already paid

        // This is an unpaid expense
        const payer = expense.paidBy;
        const group = expense.group;

        unpaidExpenses.push({
          id: `${expense._id}-${currentUser.id}`,
          expenseId: expense._id,
          expenseName: expense.description,
          expenseCategory: expense.category,
          amount: userSplit.amount,
          creditorId: paidById,
          creditorName: (typeof payer === 'object' ? payer.name : 'Unknown'),
          creditorEmail: (typeof payer === 'object' ? payer.email : ''),
          groupId: (typeof group === 'object' ? group._id : (groupId || group)),
          groupName: (typeof group === 'object' ? group.name : 'Unknown Group'),
          createdAt: expense.createdAt
        });
      });

      // Sort by date (newest first)
      unpaidExpenses.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
      setAllPayments(unpaidExpenses);
    } catch (err) {
      console.error('Failed to fetch payments', err);
      setError('Failed to load payment data');
    } finally {
      setLoading(false);
    }
  };



  const handlePay = async (payment) => {
    try {
      setLoading(true);
      const res = await paymentAPI.createCheckoutSession(payment.groupId, payment.creditorId, payment.amount);
      const url = res.data.url || res.data.sessionUrl;
      if (url) {
        window.location.href = url;
      } else {
        setError('Failed to start payment session');
      }
    } catch (err) {
      console.error(err);
      setError(err.response?.data?.message || 'Payment failed');
    } finally {
      setLoading(false);
    }
  };

  const totalOwed = allPayments.reduce((sum, p) => sum + p.amount, 0);

  if (loading) {
    return (
      <div className="text-center py-5">
        <Spinner animation="border" variant="primary" />
        <p className="mt-3">Loading payments...</p>
      </div>
    );
  }

  return (
    <div>
      {error && <Alert variant="danger" dismissible onClose={() => setError('')}>{error}</Alert>}

      {totalOwed > 0 && (
        <Card className="mb-4 shadow-sm" style={{ background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)', color: 'white' }}>
          <Card.Body className="text-center">
            <h6 className="text-white-50 mb-2">Total You Owe</h6>
            <h2 className="fw-bold mb-0">${totalOwed.toFixed(2)}</h2>
          </Card.Body>
        </Card>
      )}

      {allPayments.length === 0 ? (
        <Alert variant="success" className="text-center">
          <h5>🎉 No outstanding payments!</h5>
          <p className="mb-0">You're all settled up.</p>
        </Alert>
      ) : (
        <Card className="shadow-sm">
          <Card.Header className="bg-primary text-white">
            <h6 className="mb-0">{allPayments.length} Payment{allPayments.length !== 1 ? 's' : ''} to Make</h6>
          </Card.Header>
          <ListGroup variant="flush">
            {allPayments.map((payment) => {
              const initials = payment.creditorName.split(' ').map(n => n[0]).slice(0, 2).join('').toUpperCase();
              return (
                <ListGroup.Item key={payment.id} className="py-3">
                  <div className="d-flex justify-content-between align-items-center">
                    <div className="d-flex align-items-center gap-3">
                      <div style={{
                        width: 50,
                        height: 50,
                        borderRadius: 25,
                        background: '#6c757d',
                        color: 'white',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        fontWeight: '700',
                        fontSize: '18px'
                      }}>
                        {initials}
                      </div>
                      <div>
                        <div className="fw-bold">{payment.expenseName}</div>
                        <small className="text-muted">{payment.expenseCategory}</small>
                        <div><small className="text-muted">Pay to: {payment.creditorName}</small></div>
                        <div><small className="text-muted">Group: {payment.groupName}</small></div>
                      </div>
                    </div>
                    <div className="text-end">
                      <div className="fw-bold fs-4 text-danger mb-2">${payment.amount.toFixed(2)}</div>
                      <Button
                        variant="primary"
                        size="lg"
                        onClick={() => handlePay(payment)}
                      >
                        💳 Pay Now
                      </Button>
                    </div>
                  </div>
                </ListGroup.Item>
              );
            })}
          </ListGroup>
        </Card>
      )}
    </div>
  );
};

// AllGroupsSettlementsTab - Shows settlements for a specific group or all groups
const AllGroupsSettlementsTab = ({ groupId = null }) => {
  const { user: currentUser } = useAuth();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [allSettlements, setAllSettlements] = useState([]);

  useEffect(() => {
    if (currentUser?.id || currentUser?._id) {
      fetchAllGroupsSettlements();
    } else {
      setLoading(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentUser, groupId]);

  const fetchAllGroupsSettlements = async () => {
    if (!currentUser || !(currentUser.id || currentUser._id)) return;

    setLoading(true);
    setError('');

    try {
      let settlements = [];

      if (groupId) {
        // Fetch settlements for the specific group
        const res = await settlementAPI.getGroupSettlements(groupId);
        settlements = res.data.settlements || res.data || [];
      } else {
        // Fetch all user settlements across groups
        const res = await settlementAPI.getMySettlements();
        settlements = res.data.settlements || res.data || [];
      }

      // Sort by date (newest first)
      settlements.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
      setAllSettlements(settlements);
    } catch (err) {
      console.error('Failed to fetch settlements', err);
      setError('Failed to load settlements data');
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteSettlement = async (settlementId) => {
    if (!window.confirm('Delete this recorded payment?')) return;
    try {
      await settlementAPI.deleteSettlement(settlementId);
      fetchAllGroupsSettlements();
    } catch (err) {
      console.error(err);
      setError(err.response?.data?.message || 'Failed to delete settlement');
    }
  };

  const totalAmount = allSettlements.reduce((sum, s) => sum + s.amount, 0);

  if (loading) {
    return (
      <div className="text-center py-5">
        <Spinner animation="border" variant="primary" />
        <p className="mt-3">Loading settlements...</p>
      </div>
    );
  }

  return (
    <div>
      {error && <Alert variant="danger" dismissible onClose={() => setError('')}>{error}</Alert>}

      {totalAmount > 0 && (
        <Card className="mb-4 shadow-sm" style={{ background: 'linear-gradient(135deg, #11998e 0%, #38ef7d 100%)', color: 'white' }}>
          <Card.Body className="text-center">
            <h6 className="text-white-50 mb-2">Total Settled Amount</h6>
            <h2 className="fw-bold mb-0">${totalAmount.toFixed(2)}</h2>
            <small className="text-white-50">{allSettlements.length} settlement{allSettlements.length !== 1 ? 's' : ''}</small>
          </Card.Body>
        </Card>
      )}

      {allSettlements.length === 0 ? (
        <Alert variant="info" className="text-center">
          <h5>📭 No settlements found</h5>
          <p className="mb-0">No payments have been recorded yet.</p>
        </Alert>
      ) : (
        <Card className="shadow-sm">
          <Card.Header className="bg-success text-white">
            <h6 className="mb-0">Recorded Settlements</h6>
          </Card.Header>
          <ListGroup variant="flush">
            {allSettlements.map((settlement) => {
              const fromInitials = settlement.from?.name?.split(' ').map(n => n[0]).slice(0, 2).join('').toUpperCase() || 'U';
              const toInitials = settlement.to?.name?.split(' ').map(n => n[0]).slice(0, 2).join('').toUpperCase() || 'U';

              return (
                <ListGroup.Item key={settlement._id} className="py-3">
                  <div className="d-flex justify-content-between align-items-center">
                    <div className="d-flex align-items-center gap-3">
                      <div className="d-flex align-items-center gap-2">
                        <div style={{
                          width: 40,
                          height: 40,
                          borderRadius: 20,
                          background: '#dc3545',
                          color: 'white',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          fontWeight: '700',
                          fontSize: '14px'
                        }}>
                          {fromInitials}
                        </div>
                        <span className="fw-bold">→</span>
                        <div style={{
                          width: 40,
                          height: 40,
                          borderRadius: 20,
                          background: '#28a745',
                          color: 'white',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          fontWeight: '700',
                          fontSize: '14px'
                        }}>
                          {toInitials}
                        </div>
                      </div>
                      <div>
                        <div>
                          <strong>{settlement.from?.name || 'Unknown'}</strong> paid{' '}
                          <strong>{settlement.to?.name || 'Unknown'}</strong>
                        </div>
                        <small className="text-muted">Group: {settlement.group?.name || 'Unknown Group'}</small>
                        {settlement.note && (
                          <div><small className="text-muted">Note: {settlement.note}</small></div>
                        )}
                        <div><small className="text-muted">{new Date(settlement.createdAt).toLocaleString()}</small></div>
                      </div>
                    </div>
                    <div className="text-end d-flex align-items-center gap-3">
                      <Badge bg="success" className="fs-5 px-3 py-2">
                        ${settlement.amount.toFixed(2)}
                      </Badge>
                      <Button
                        variant="outline-danger"
                        size="sm"
                        onClick={() => handleDeleteSettlement(settlement._id)}
                        title="Delete settlement"
                      >
                        <FaTrash />
                      </Button>
                    </div>
                  </div>
                </ListGroup.Item>
              );
            })}
          </ListGroup>
        </Card>
      )}
    </div>
  );
};

export default GroupDetail;
