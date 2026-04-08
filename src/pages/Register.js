import React, { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { authAPI } from '../api/axios';
import { useNavigate } from 'react-router-dom';
import { Container, Row, Col, Form, Button, Card, Alert } from 'react-bootstrap';
import '../styles/Auth.css';

const Register = () => {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const { login } = useAuth();
  const navigate = useNavigate();

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      await authAPI.register(name, email, password);
      const response = await authAPI.login(email, password);
      login(response.data.user, response.data.token);
      navigate('/groups');
    } catch (err) {
      setError(err.response?.data?.message || 'Registration failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="auth-page">
      <Container>
        <Row className="justify-content-center align-items-center min-vh-100">
          <Col md={5}>
            <Card className="auth-card shadow-lg">
              <Card.Body className="p-5">
                <h1 className="text-center mb-4 text-primary fw-bold">✨ Register</h1>
                
                {error && (
                  <Alert variant="danger" className="mb-4">
                    {error}
                  </Alert>
                )}

                <Form onSubmit={handleSubmit}>
                  <Form.Group className="mb-3">
                    <Form.Label className="fw-bold">Full Name</Form.Label>
                    <Form.Control
                      type="text"
                      placeholder="Enter your name"
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      required
                      size="lg"
                    />
                  </Form.Group>

                  <Form.Group className="mb-3">
                    <Form.Label className="fw-bold">Email Address</Form.Label>
                    <Form.Control
                      type="email"
                      placeholder="Enter your email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      required
                      size="lg"
                    />
                  </Form.Group>

                  <Form.Group className="mb-4">
                    <Form.Label className="fw-bold">Password</Form.Label>
                    <Form.Control
                      type="password"
                      placeholder="Create a password"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      required
                      size="lg"
                    />
                  </Form.Group>

                  <Button
                    variant="primary"
                    type="submit"
                    disabled={loading}
                    className="w-100 mb-3"
                    size="lg"
                  >
                    {loading ? 'Registering...' : 'Register'}
                  </Button>
                </Form>

                <div className="text-center">
                  <p className="text-muted">
                    Already have an account?{' '}
                    <a href="/login" className="text-primary fw-bold">
                      Login here
                    </a>
                  </p>
                </div>
              </Card.Body>
            </Card>
          </Col>
        </Row>
      </Container>
    </div>
  );
};

export default Register;
