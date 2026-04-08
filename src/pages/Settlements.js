import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { settlementAPI } from '../api/axios';
import { Container, Card, Alert, Spinner, ListGroup, Badge, Button } from 'react-bootstrap';
import { FaTrash } from 'react-icons/fa';

const Settlements = () => {
    const { user: currentUser } = useAuth();
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const [allSettlements, setAllSettlements] = useState([]);

    useEffect(() => {
        if (currentUser?.id || currentUser?._id) {
            fetchAllSettlements();
        } else {
            setLoading(false);
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [currentUser]);

    const fetchAllSettlements = async () => {
        if (!currentUser || !(currentUser.id || currentUser._id)) return;

        setLoading(true);
        setError('');

        try {
            // Use the same API as Navigation - it works!
            const sres = await settlementAPI.getMySettlements();
            const settlements = sres.data.settlements || sres.data || [];

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
            fetchAllSettlements();
        } catch (err) {
            console.error(err);
            setError(err.response?.data?.message || 'Failed to delete settlement');
        }
    };

    const totalAmount = allSettlements.reduce((sum, s) => sum + s.amount, 0);

    if (loading) {
        return (
            <Container className="py-5">
                <div className="text-center py-5">
                    <Spinner animation="border" variant="success" />
                    <p className="mt-3">Loading settlements...</p>
                </div>
            </Container>
        );
    }

    return (
        <Container className="py-5">
            <h1 className="mb-4 text-success fw-bold">✅ All Settlements</h1>

            {error && <Alert variant="danger" dismissible onClose={() => setError('')}>{error}</Alert>}

            {totalAmount > 0 && (
                <Card className="mb-4 shadow-sm" style={{ background: 'linear-gradient(135deg, #11998e 0%, #38ef7d 100%)', color: 'white' }}>
                    <Card.Body>
                        <div className="text-center">
                            <h6 className="text-white-50 mb-2">Total Settled Amount</h6>
                            <h2 className="fw-bold mb-0">${totalAmount.toFixed(2)}</h2>
                            <small className="text-white-50">{allSettlements.length} settlement{allSettlements.length !== 1 ? 's' : ''}</small>
                        </div>
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
        </Container>
    );
};

export default Settlements;
