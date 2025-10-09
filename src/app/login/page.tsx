'use client';

import React, {useState, useEffect, useRef} from 'react';
import {useRouter, useSearchParams} from 'next/navigation';
import {Card, Form, Input, Button, Typography, Space, App, Checkbox} from 'antd';
import {UserOutlined, LockOutlined, LoginOutlined} from '@ant-design/icons';
import {useAuthStore} from '@/stores/auth';

const {Title, Text} = Typography;

interface LoginForm {
    username: string;
    password: string;
    remember: boolean;
}

export default function LoginPage() {
    const [form] = Form.useForm();
    const [loading, setLoading] = useState(false);
    const router = useRouter();
    const searchParams = useSearchParams();
    const {login, isAuthenticated, hasHydrated} = useAuthStore();
    const {message} = App.useApp();
    const redirectedRef = useRef(false);

    const redirectUrl = searchParams.get('redirect') || '/dashboard';

    // 已登录时直接跳转（避免多次触发）
    useEffect(() => {
        if (!hasHydrated) return;
        if (isAuthenticated && !redirectedRef.current) {
            redirectedRef.current = true;
            // 短暂延迟，确保 cookie 持久化后中间件可读取
            const timer = setTimeout(() => {
                try {
                    router.replace(redirectUrl);
                    console.log('router.replace',redirectUrl);
                } catch {
                    window.location.href = redirectUrl;
                }
            }, 120);
            return () => {
                clearTimeout(timer);
            };
        }
    }, [hasHydrated, isAuthenticated, router, redirectUrl]);

    const handleSubmit = async (values: LoginForm) => {
        setLoading(true);
        try {
            const response = await fetch('/api/auth/login', {
                method: 'POST',
                headers: {'Content-Type': 'application/json'},
                credentials: 'same-origin',
                body: JSON.stringify({
                    username: values.username,
                    password: values.password,
                    remember: values.remember
                })
            });

            const data = await response.json();
            if (data.success && data.data) {
                message.success('登录成功！');
                // 显式写入 cookie，确保中间件立刻可读
                try {
                    const isHttps = typeof window !== 'undefined' && window.location.protocol === 'https:';
                    const secureAttr = isHttps ? '; Secure' : '';
                    const maxAge = Number(data.data.expiresIn) || 8 * 60 * 60;
                    document.cookie = `auth-token=${data.data.token}; Path=/; Max-Age=${maxAge}; SameSite=Lax${secureAttr}`;
                } catch {}
                // 更新本地认证状态
                login(data.data.user, data.data.token);
                console.log('登录成功，准备跳转...',redirectedRef.current);
                // 直接跳转，避免依赖额外状态引起的清理问题
                if (!redirectedRef.current) {
                    redirectedRef.current = true;
                    setTimeout(() => {
                        try {
                            router.replace(redirectUrl);
                        } catch {
                            window.location.href = redirectUrl;
                        }
                    }, 120);
                }
            } else {
                message.error(data.error || '登录失败');
            }
        } catch (error) {
            message.error('网络错误，请稍后重试');
        } finally {
            setLoading(false);
        }
    };

    const handleSubmitFailed = () => {
        message.error('请检查输入信息');
    };

    return (
        <div
            style={{
                minHeight: '100vh',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                padding: '20px'
            }}>
            <Card
                style={{
                    width: '100%',
                    maxWidth: 400,
                    boxShadow: '0 8px 32px rgba(0, 0, 0, 0.1)',
                    borderRadius: '12px'
                }}
                styles={{body: {padding: '40px'}}}>
                <div style={{textAlign: 'center', marginBottom: '32px'}}>
                    <Title level={2} style={{margin: 0, color: '#1890ff'}}>
                        Weekly 内容管理系统
                    </Title>
                    <Text type='secondary' style={{fontSize: '14px'}}>
                        请登录您的账户
                    </Text>
                </div>

                <Form
                    form={form}
                    name='login'
                    onFinish={handleSubmit}
                    onFinishFailed={handleSubmitFailed}
                    autoComplete='off'
                    size='large'
                    layout='vertical'>
                    <Form.Item
                        name='username'
                        rules={[
                            {required: true, message: '请输入用户名'},
                            {min: 2, message: '用户名至少2个字符'}
                        ]}>
                        <Input prefix={<UserOutlined />} placeholder='用户名' autoComplete='username' />
                    </Form.Item>

                    <Form.Item
                        name='password'
                        rules={[
                            {required: true, message: '请输入密码'},
                            {min: 6, message: '密码至少6个字符'}
                        ]}>
                        <Input.Password prefix={<LockOutlined />} placeholder='密码' autoComplete='current-password' />
                    </Form.Item>

                    <Form.Item>
                        <Space style={{width: '100%', justifyContent: 'space-between'}}>
                            <Form.Item name='remember' valuePropName='checked' noStyle>
                                <Checkbox>记住我</Checkbox>
                            </Form.Item>
                        </Space>
                    </Form.Item>

                    <Form.Item style={{marginBottom: '16px'}}>
                        <Button
                            type='primary'
                            htmlType='submit'
                            loading={loading}
                            block
                            icon={<LoginOutlined />}
                            style={{height: '44px', fontSize: '16px'}}>
                            {loading ? '登录中...' : '登录'}
                        </Button>
                    </Form.Item>
                </Form>

                <div style={{textAlign: 'center', marginTop: '24px'}}>
                    <Text type='secondary' style={{fontSize: '12px'}}>
                        测试账户：admin / admin123 或 editor / editor123
                    </Text>
                </div>
            </Card>
        </div>
    );
}
