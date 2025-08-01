import type {Metadata} from 'next';
import '@ant-design/v5-patch-for-react-19';
import {AntdRegistry} from '@ant-design/nextjs-registry';
import {ConfigProvider, App} from 'antd';
import zhCN from 'antd/locale/zh_CN';
import ClientProvider from '@/components/providers/ClientProvider';
import ErrorBoundary from '@/components/providers/ErrorBoundary';
import NoSSR from '@/components/providers/NoSSR';
import QueryProvider from '@/components/providers/QueryProvider';
import StartupProvider from '@/components/providers/StartupProvider';
import './globals.css';

export const metadata: Metadata = {
    title: 'Weekly 内容管理系统',
    description: '专业的周刊内容管理平台'
};

export default function RootLayout({
    children
}: Readonly<{
    children: React.ReactNode;
}>) {
    return (
        <html lang='zh-CN'>
            <body>
                <ErrorBoundary>
                    <AntdRegistry>
                        <ConfigProvider
                            locale={zhCN}
                            theme={{
                                token: {
                                    colorPrimary: '#1890ff',
                                    borderRadius: 6
                                }
                            }}>
                            <App>
                                <QueryProvider>
                                    <NoSSR>
                                        <StartupProvider>
                                            <ClientProvider>{children}</ClientProvider>
                                        </StartupProvider>
                                    </NoSSR>
                                </QueryProvider>
                            </App>
                        </ConfigProvider>
                    </AntdRegistry>
                </ErrorBoundary>
            </body>
        </html>
    );
}
