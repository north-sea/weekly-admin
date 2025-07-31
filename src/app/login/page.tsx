'use client';

import React, {useState, useEffect} from 'react';
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
    const [isRedirecting, setIsRedirecting] = useState(false);
    const router = useRouter();
    const searchParams = useSearchParams();
    const {login, isAuthenticated, hasHydrated} = useAuthStore();
    const {message} = App.useApp();

    const redirectUrl = searchParams.get('redirect') || '/dashboard';

    // 添加调试状态监控
    useEffect(() => {
        console.log('登录页面状态监控:', {
            isAuthenticated,
            hasHydrated,
            redirectUrl,
            timestamp: new Date().toISOString()
        });
    }, [isAuthenticated, hasHydrated, redirectUrl]);

    // Redirect if already authenticated
    useEffect(() => {
        console.log('认证状态检查:', {isAuthenticated, hasHydrated, isRedirecting, redirectUrl});

                 // 防止重复跳转，确保 store 完全水合后再执行跳转逻辑
         if (isAuthenticated && hasHydrated && !isRedirecting) {
             console.log('用户已认证且状态已水合，准备跳转到:', redirectUrl);
             setIsRedirecting(true);
 
             // 添加短暂延迟确保 cookie 已设置，middleware 可以读取
             const timer = setTimeout(() => {
                 console.log('执行跳转到:', redirectUrl);
 
                 try {
                     console.log('使用 router.replace 跳转');
                     router.replace(redirectUrl);
                 } catch (error) {
                     console.warn('router.replace 失败，使用 window.location:', error);
                     window.location.href = redirectUrl;
                 }
             }, 200);
             
             return () => {
                 console.log('清理跳转定时器');
                 clearTimeout(timer);
             };
         } else if (isAuthenticated && !hasHydrated && !isRedirecting) {
             console.log('用户已认证但状态未完全水合，等待水合完成...');
         }
    }, [isAuthenticated, hasHydrated, isRedirecting, router, redirectUrl]);

    const handleSubmit = async (values: LoginForm) => {
        setLoading(true);

        try {
            const response = await fetch('/api/auth/login', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    username: values.username,
                    password: values.password,
                    remember: values.remember
                })
            });

            const data = await response.json();

            if (data.success && data.data) {
                console.log('登录成功，准备更新状态...', {user: data.data.user, token: data.data.token});
                message.success('登录成功！');
                login(data.data.user, data.data.token);

                // 移除手动跳转，让 useEffect 处理自动跳转
                console.log('状态已更新，等待自动跳转到:', redirectUrl);
            } else {
                message.error(data.error || '登录失败');
            }
        } catch (error) {
            console.error('Login error:', error);
            message.error('网络错误，请稍后重试');
        } finally {
            setLoading(false);
        }
    };

    const handleSubmitFailed = (errorInfo: unknown) => {
        console.log('Failed:', errorInfo);
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
