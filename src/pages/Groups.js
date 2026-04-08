import React, { useState, useEffect } from 'react';
import { groupAPI, authAPI } from '../api/axios';
import { useAuth } from '../context/AuthContext';
import { useNavigate } from 'react-router-dom';
import { Container, Row, Col, Button, Card, Form, Alert, Spinner, Badge } from 'react-bootstrap';
import { FaPlus, FaFolder, FaTimes } from 'react-icons/fa';
import '../styles/Groups.css';

const Groups = () => {
  const { user: currentUser } = useAuth();
  const [groups, setGroups] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [formData, setFormData] = useState({ name: '', description: '', selectedUserId: '' });
  const [selectedMembers, setSelectedMembers] = useState([]);
  const [allUsers, setAllUsers] = useState([]);
  const navigate = useNavigate();

  useEffect(() => {
    fetchGroups();
    fetchAllUsers();
  }, []);

  const fetchAllUsers = async () => {
    try {
      const response = await authAPI.getAllUsers();
      setAllUsers(response.data.users || response.data || []);
    } catch (err) {
      console.error('Error fetching users:', err);
    }
  };

  const fetchGroups = async () => {
    try {
      const response = await groupAPI.getUserGroups();
      setGroups(response.data.groups || []);
      setError('');
    } catch (err) {
      console.error('Error fetching groups:', err);
      if (err.response?.status === 401) {
        setError('Session expired. Please log in again.');
        // Clear invalid auth data
        localStorage.removeItem('token');
        localStorage.removeItem('user');
        // Redirect to login after a short delay
        setTimeout(() => {
          window.location.href = '/login';
        }, 2000);
      } else {
        setError(err.response?.data?.message || 'Failed to fetch groups');
      }
      setGroups([]);
    } finally {
      setLoading(false);
    }
  };

  const handleAddMember = () => {
    const userId = formData.selectedUserId;
    if (userId && !selectedMembers.find(m => m._id === userId)) {
      const user = allUsers.find(u => u._id === userId);
      if (user) {
        setSelectedMembers([...selectedMembers, user]);
        setFormData({ ...formData, selectedUserId: '' });
      }
    }
  };

  const handleRemoveMember = (userId) => {
    setSelectedMembers(selectedMembers.filter(m => m._id !== userId));
  };

  const handleCreateGroup = async (e) => {
    e.preventDefault();

    // Validate input
    if (!formData.name || formData.name.trim() === '') {
      setError('Group name is required');
      return;
    }

    try {
      setError('');
      const memberIds = selectedMembers.map(m => m._id);
      await groupAPI.createGroup(formData.name.trim(), formData.description.trim(), memberIds);
      setFormData({ name: '', description: '', selectedUserId: '' });
      setSelectedMembers([]);
      setShowForm(false);
      fetchGroups();
    } catch (err) {
      console.error('Error creating group:', err);
      setError(err.response?.data?.message || 'Failed to create group');
    }
  };

  if (loading) return (
    <Container className="text-center py-5">
      <Spinner animation="border" variant="primary" />
      <p className="mt-3">Loading groups...</p>
    </Container>
  );

  return (
    <Container className="py-5">
      <Row className="mb-5">
        <Col md={8}>
          <h1 className="mb-2 fw-bold" style={{
            background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
            WebkitBackgroundClip: 'text',
            WebkitTextFillColor: 'transparent',
            backgroundClip: 'text'
          }}>
            <FaFolder className="me-2" style={{ color: '#667eea' }} />
            Your Groups
          </h1>
        </Col>
        <Col md={4} className="text-end">
          <Button
            variant={showForm ? 'danger' : 'success'}
            size="lg"
            onClick={() => setShowForm(!showForm)}
            className="d-flex align-items-center gap-2 ms-auto"
            style={{
              background: showForm
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
            <FaPlus /> {showForm ? 'Cancel' : 'Create Group'}
          </Button>
        </Col>
      </Row>

      {error && <Alert variant="danger" className="mb-4">{error}</Alert>}

      {showForm && (
        <Card className="mb-5 shadow-sm border-0">
          <Card.Header className="bg-light">
            <h5 className="mb-0">Create New Group</h5>
          </Card.Header>
          <Card.Body>
            <Form onSubmit={handleCreateGroup}>
              <Form.Group className="mb-3">
                <Form.Label className="fw-bold">Group Name</Form.Label>
                <Form.Control
                  type="text"
                  placeholder="Enter group name"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  required
                  size="lg"
                />
              </Form.Group>
              <Form.Group className="mb-4">
                <Form.Label className="fw-bold">Description</Form.Label>
                <Form.Control
                  as="textarea"
                  rows={3}
                  placeholder="Enter group description"
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                />
              </Form.Group>

              <Form.Group className="mb-4">
                <Form.Label className="fw-bold">Add Members (Optional)</Form.Label>
                <div className="d-flex gap-2 mb-2">
                  <Form.Select
                    value={formData.selectedUserId}
                    onChange={(e) => setFormData({ ...formData, selectedUserId: e.target.value })}
                  >
                    <option value="">Select a user...</option>
                    {allUsers
                      .filter(user =>
                        user._id !== (currentUser?.id || currentUser?._id) && // Exclude current user (group creator)
                        !selectedMembers.find(m => m._id === user._id) // Exclude already selected members
                      )
                      .map(user => (
                        <option key={user._id} value={user._id}>
                          {user.name} ({user.email})
                        </option>
                      ))
                    }
                  </Form.Select>
                  <Button variant="outline-primary" onClick={handleAddMember} type="button" disabled={!formData.selectedUserId}>
                    <FaPlus /> Add
                  </Button>
                </div>
                {selectedMembers.length > 0 && (
                  <div className="d-flex flex-wrap gap-2 mb-2">
                    {selectedMembers.map((member) => (
                      <Badge key={member._id} bg="primary" className="d-flex align-items-center gap-2 px-3 py-2">
                        {member.name} ({member.email})
                        <FaTimes
                          style={{ cursor: 'pointer' }}
                          onClick={() => handleRemoveMember(member._id)}
                        />
                      </Badge>
                    ))}
                  </div>
                )}
                <Form.Text className="text-muted">
                  Select users from the dropdown to add them to the group
                </Form.Text>
              </Form.Group>

              <Button variant="primary" type="submit" size="lg">
                Create Group
              </Button>
            </Form>
          </Card.Body>
        </Card>
      )}

      {!groups || groups.length === 0 ? (
        <div className="text-center py-5">
          <div style={{
            fontSize: '4rem',
            marginBottom: '1rem',
            opacity: 0.3
          }}>📁</div>
          <h4 className="text-muted">No groups yet</h4>
          <p className="text-secondary">Create your first group to get started!</p>
        </div>
      ) : (
        <Row className="g-4">
          {groups.map((group) => (
            <Col lg={4} md={6} key={group._id}>
              <Card
                className="h-100 shadow-sm group-card cursor-pointer"
                onClick={() => navigate(`/group/${group._id}`)}
                style={{
                  border: 'none',
                  borderRadius: '15px',
                  overflow: 'hidden',
                  transition: 'all 0.3s ease',
                  background: 'white',
                  position: 'relative'
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.transform = 'translateY(-8px)';
                  e.currentTarget.style.boxShadow = '0 12px 24px rgba(0,0,0,0.15)';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.transform = 'translateY(0)';
                  e.currentTarget.style.boxShadow = '0 2px 8px rgba(0,0,0,0.1)';
                }}
              >
                {/* Gradient Header */}
                <div style={{
                  background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                  padding: '1.5rem',
                  color: 'white'
                }}>
                  <Card.Title className="fw-bold mb-1" style={{ fontSize: '1.3rem' }}>
                    {group.name || 'Unnamed Group'}
                  </Card.Title>
                  <Card.Text style={{
                    fontSize: '0.9rem',
                    opacity: 0.9,
                    minHeight: '20px'
                  }}>
                    {group.description || 'No description'}
                  </Card.Text>
                </div>

                {/* Card Body */}
                <Card.Body style={{ padding: '1.5rem' }}>
                  <div className="d-flex justify-content-around">
                    <div className="text-center">
                      <div style={{
                        width: '50px',
                        height: '50px',
                        borderRadius: '50%',
                        background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        margin: '0 auto 0.5rem',
                        color: 'white',
                        fontSize: '1.5rem'
                      }}>
                        👥
                      </div>
                      <div className="fw-bold" style={{ fontSize: '1.2rem', color: '#667eea' }}>
                        {(group.members && group.members.length) || 0}
                      </div>
                      <small className="text-muted">Members</small>
                    </div>
                    <div className="text-center">
                      <div style={{
                        width: '50px',
                        height: '50px',
                        borderRadius: '50%',
                        background: 'linear-gradient(135deg, #f093fb 0%, #f5576c 100%)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        margin: '0 auto 0.5rem',
                        color: 'white',
                        fontSize: '1.5rem'
                      }}>
                        💰
                      </div>
                      <div className="fw-bold" style={{ fontSize: '1.2rem', color: '#f5576c' }}>
                        {(group.expenses && group.expenses.length) || 0}
                      </div>
                      <small className="text-muted">Expenses</small>
                    </div>
                  </div>
                </Card.Body>
              </Card>
            </Col>
          ))}
        </Row>
      )}
    </Container>
  );
};

export default Groups;
