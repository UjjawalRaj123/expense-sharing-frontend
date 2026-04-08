import React, { useState, useEffect, useCallback } from 'react';
import { useAuth } from '../context/AuthContext';
import { groupAPI, expenseAPI, settlementAPI, paymentAPI } from '../api/axios';
import { Container, Card, Alert, Spinner, ListGroup, Button } from 'react-bootstrap';

const Payments = () => {
    const { user: currentUser } = useAuth();
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const [payments, setPayments] = useState([]);

    const fetchPayments = useCallback(async () => {
        if (!currentUser || !(currentUser.id || currentUser._id)) return;

        setLoading(true);
        setError('');

        try {
            // Fetch all expenses and settlements involving user in parallel
            const [expensesRes, settlementsRes] = await Promise.all([
                expenseAPI.getMyExpenses(),
                settlementAPI.getMySettlements()
            ]);

            const expenses = expensesRes.data.expenses || [];
            const settlements = settlementsRes.data.settlements || [];

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
                    id: `${expense._id}-${currentUserId}`,
                    expenseId: expense._id,
                    expenseName: expense.description,
                    expenseCategory: expense.category,
                    amount: userSplit.amount,
                    creditorId: paidById,
                    creditorName: (typeof payer === 'object' ? payer.name : 'Unknown'),
                    creditorEmail: (typeof payer === 'object' ? payer.email : ''),
                    groupId: (typeof group === 'object' ? group._id : group),
                    groupName: (typeof group === 'object' ? group.name : 'Unknown Group'),
                    createdAt: expense.createdAt
                });
            });

            // Sort by date (newest first)
            unpaidExpenses.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
            setPayments(unpaidExpenses);
        } catch (err) {
            console.error('Failed to fetch payments', err);
            setError('Failed to load payment data');
        } finally {
            setLoading(false);
        }
    }, [currentUser]);

    useEffect(() => {
        if (currentUser?.id || currentUser?._id) {
            fetchPayments();
        } else {
            setLoading(false);
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [currentUser]);

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

    const totalOwed = payments.reduce((sum, p) => sum + p.amount, 0);

    if (loading) {
        return (
            <Container className="py-5">
                <div className="text-center py-5">
                    <Spinner animation="border" variant="primary" />
                    <p className="mt-3">Loading payments...</p>
                </div>
            </Container>
        );
    }

    return (
        <Container className="py-5">
            <h1 className="mb-4 text-primary fw-bold">💰 Payments</h1>

            {error && <Alert variant="danger" dismissible onClose={() => setError('')}>{error}</Alert>}

            {totalOwed > 0 && (
                <Card className="mb-4 shadow-sm" style={{ background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)', color: 'white' }}>
                    <Card.Body className="text-center">
                        <h6 className="text-white-50 mb-2">Total You Owe</h6>
                        <h2 className="fw-bold mb-0">${totalOwed.toFixed(2)}</h2>
                    </Card.Body>
                </Card>
            )}

            {payments.length === 0 ? (
                <Alert variant="success" className="text-center">
                    <h5>🎉 No outstanding payments!</h5>
                    <p className="mb-0">You're all settled up.</p>
                </Alert>
            ) : (
                <Card className="shadow-sm">
                    <Card.Header className="bg-primary text-white">
                        <h6 className="mb-0">{payments.length} Payment{payments.length !== 1 ? 's' : ''} to Make</h6>
                    </Card.Header>
                    <ListGroup variant="flush">
                        {payments.map((payment) => {
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
        </Container>
    );
};

export default Payments;
